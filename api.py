import sys
from pathlib import Path
from typing import List, Optional, Dict, Any
import json
from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

# Ensure project root is in path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from indexer import DocumentScanner, DocumentInfo, IndexManager, SearchResult
from ai import AISummarizer
from config import get_settings
from zotero import CollectionManager
from utils import get_logger

app = FastAPI(title="Zotero Chat API")
logger = get_logger(__name__)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global state (simplified for single-user local usage)
class GlobalState:
    def __init__(self):
        self.scanner = DocumentScanner()
        self.summarizer = AISummarizer()
        self.current_documents: List[DocumentInfo] = []
        # 当前已扫描的集合名称（用于前端恢复状态）
        self.current_collection_name: Optional[str] = None
        # 语义搜索索引管理器（索引当前集合的文档）
        self.index_manager = IndexManager()
        # 当前索引对应的集合名称（用于按需重建索引）
        self.index_collection_name: Optional[str] = None


state = GlobalState()

class CollectionResponse(BaseModel):
    key: str
    name: str
    num_items: int
    parent_key: Optional[str] = None

class ScanRequest(BaseModel):
    collection_name: str
    load_pdf: bool = True

class SummarizeRequest(BaseModel):
    doc_ids: List[str]
    summary_type: str = "full"  # full, quick, key_points

class ResearchRequest(BaseModel):
    doc_ids: List[str]
    question: str

class ChatRequest(BaseModel):
    message: str
    doc_ids: Optional[List[str]] = None
    history: List[Dict[str, str]] = []


class SearchRequest(BaseModel):
    query: str
    n_results: int = 10

class QuickCategorizeRequest(BaseModel):
    doc_ids: List[str]

@app.get("/api/collections")
async def list_collections():
    try:
        # Access CollectionManager directly from scanner
        manager = state.scanner._collection_manager
        collections = manager.get_all_collections()
        return [
            {
                "key": c.key, 
                "name": c.name, 
                "num_items": c.num_items, 
                "parent_key": c.parent_key
            } 
            for c in collections
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/scan")
async def scan_collection(request: ScanRequest):
    try:
        documents = state.scanner.scan_collection(
            request.collection_name,
            include_subcollections=False,
            load_pdf_content=request.load_pdf
        )
        state.current_documents = documents
        state.current_collection_name = request.collection_name
        # 每次扫描后重置索引标记，真正构建索引放到 /api/search 中按需处理
        state.index_collection_name = None

        # Pydantic should handle DocumentInfo serialization
        return documents
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/documents")
async def get_documents():
    """返回当前已扫描的文档及集合名称，便于前端在刷新后恢复状态。"""
    return {
        "collection_name": state.current_collection_name,
        "documents": state.current_documents,
    }

def _ensure_pdf_loaded(docs: List[DocumentInfo]) -> List[DocumentInfo]:
    """
    确保文档的 PDF 内容已加载。
    对于未加载 PDF 的文档，按需加载。
    """
    for doc in docs:
        if doc.has_pdf and not doc.pdf_loaded:
            logger.info(f"按需加载 PDF: {doc.title}")
            state.scanner.load_pdf_content(doc.id)
    return docs


@app.post("/api/summarize")
def summarize_documents(request: SummarizeRequest):
    try:
        # Filter selected documents
        selected_docs = [d for d in state.current_documents if d.id in request.doc_ids]
        
        if not selected_docs:
            raise HTTPException(status_code=400, detail="No documents found with provided IDs")

        # 按需加载 PDF 内容
        selected_docs = _ensure_pdf_loaded(selected_docs)

        # 使用流式输出（同步生成器，避免阻塞事件循环导致缓冲）
        def generate():
            try:
                if len(selected_docs) == 1:
                    type_map = {"full": "full", "quick": "quick", "key_points": "key_points"}
                    title = selected_docs[0].title
                    # 发送标题
                    yield f"data: {json.dumps({'type': 'title', 'content': title})}\n\n"
                    # 流式生成内容
                    for chunk in state.summarizer.summarize_document(
                        selected_docs[0], 
                        summary_type=type_map.get(request.summary_type, "full"),
                        stream=True
                    ):
                        yield f"data: {json.dumps({'type': 'content', 'content': chunk})}\n\n"
                else:
                    title = f"综合分析: {len(selected_docs)} 篇文献"
                    yield f"data: {json.dumps({'type': 'title', 'content': title})}\n\n"
                    for chunk in state.summarizer.summarize_multiple(selected_docs, stream=True):
                        yield f"data: {json.dumps({'type': 'content', 'content': chunk})}\n\n"
                
                yield f"data: {json.dumps({'type': 'done'})}\n\n"
            except Exception as e:
                yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"
        
        return StreamingResponse(generate(), media_type="text/event-stream")
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/research")
def deep_research(request: ResearchRequest):
    try:
        selected_docs = [d for d in state.current_documents if d.id in request.doc_ids]
        if not selected_docs:
            raise HTTPException(status_code=400, detail="No documents found with provided IDs")
        
        # 按需加载 PDF 内容
        selected_docs = _ensure_pdf_loaded(selected_docs)
        
        # 使用流式输出（同步生成器，避免阻塞事件循环导致缓冲）
        def generate():
            try:
                yield f"data: {json.dumps({'type': 'title', 'content': '深度研究报告'})}\n\n"
                for chunk in state.summarizer.deep_research(request.question, selected_docs, stream=True):
                    yield f"data: {json.dumps({'type': 'content', 'content': chunk})}\n\n"
                yield f"data: {json.dumps({'type': 'done'})}\n\n"
            except Exception as e:
                yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"
        
        return StreamingResponse(generate(), media_type="text/event-stream")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/chat")
async def chat(request: ChatRequest):
    try:
        context_docs = None
        if request.doc_ids:
            context_docs = [d for d in state.current_documents if d.id in request.doc_ids]
            # 按需加载 PDF 内容
            context_docs = _ensure_pdf_loaded(context_docs)
        
        response = state.summarizer.chat(
            request.message,
            context=context_docs,
            history=request.history
        )
        return {"response": response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/quick-categorize")
def quick_categorize(request: QuickCategorizeRequest):
    """
    快速分类汇总：仅使用文献摘要进行分类和汇总，无需加载 PDF 内容。
    适合快速了解一组文献的整体情况。
    """
    try:
        logger.info(f"快速分类请求: doc_ids={request.doc_ids}, 当前文档数={len(state.current_documents)}")
        
        selected_docs = [d for d in state.current_documents if d.id in request.doc_ids]
        logger.info(f"找到匹配文档: {len(selected_docs)} 篇")
        
        if not selected_docs:
            logger.error(f"未找到匹配文档。请求的 IDs: {request.doc_ids}, 可用的 IDs: {[d.id for d in state.current_documents][:10]}")
            raise HTTPException(status_code=400, detail="No documents found with provided IDs")
        
        # 使用流式输出（同步生成器，避免阻塞事件循环导致缓冲）
        def generate():
            try:
                title = f"快速分类汇总: {len(selected_docs)} 篇文献"
                yield f"data: {json.dumps({'type': 'title', 'content': title})}\n\n"
                logger.info(f"开始调用 quick_categorize 方法")
                for chunk in state.summarizer.quick_categorize(selected_docs, stream=True):
                    yield f"data: {json.dumps({'type': 'content', 'content': chunk})}\n\n"
                yield f"data: {json.dumps({'type': 'done'})}\n\n"
                logger.info("快速分类完成")
            except Exception as e:
                logger.error(f"流式生成错误: {type(e).__name__}: {str(e)}", exc_info=True)
                yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"
        
        return StreamingResponse(generate(), media_type="text/event-stream")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"快速分类错误: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/search")
async def semantic_search(request: SearchRequest):
    """
    对当前已扫描集合进行语义搜索。
    依赖于 /api/scan 之后构建的索引。
    """
    try:
        if not state.current_documents:
            raise HTTPException(status_code=400, detail="请先扫描一个集合")

        try:
            # 如果索引还未针对当前集合构建，则在首次搜索时构建
            if state.index_collection_name != state.current_collection_name:
                state.index_manager.clear()
                state.index_manager.add_documents(state.current_documents)
                state.index_collection_name = state.current_collection_name
                logger.info(
                    "已为集合构建索引: collection=%s, docs=%d",
                    state.current_collection_name,
                    len(state.current_documents),
                )

            results: List[SearchResult] = state.index_manager.search(
                request.query,
                n_results=request.n_results,
            )
        except ImportError as e:
            # chromadb 未安装等情况
            raise HTTPException(
                status_code=500,
                detail=str(e),
            )

        return results
    except HTTPException:
        # 直接抛出已有 HTTPException
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
