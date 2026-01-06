import sys
import asyncio
from pathlib import Path
from typing import List, Optional, Dict, Any
from contextlib import asynccontextmanager
from threading import Lock
import json
import time
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse, FileResponse
from pydantic import BaseModel, Field, field_validator
from starlette.middleware.base import BaseHTTPMiddleware

# Ensure project root is in path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from indexer import DocumentScanner, DocumentInfo, IndexManager, SearchResult
from ai import AISummarizer
from config import get_settings
from zotero import CollectionManager
from utils import get_logger

logger = get_logger(__name__)


# ============ 线程安全的全局状态管理 ============
class GlobalState:
    """线程安全的全局状态管理，支持会话持久化"""
    
    SESSION_FILE = Path("./data/session.json")
    
    def __init__(self):
        self._lock = Lock()  # 并发锁保护
        self.scanner = DocumentScanner()
        self.summarizer = AISummarizer()
        self.current_documents: List[DocumentInfo] = []
        self.current_collection_name: Optional[str] = None
        self.index_manager = IndexManager()
        self.index_collection_name: Optional[str] = None
        # 索引文档ID缓存，用于增量索引
        self._indexed_doc_ids: set = set()
        # 请求去重缓存
        self._request_cache: Dict[str, tuple] = {}  # hash -> (timestamp, result)
        self._cache_ttl = 5  # 缓存有效期（秒）
    
    def with_lock(self, func):
        """带锁执行函数"""
        with self._lock:
            return func()
    
    def save_session(self):
        """保存会话状态到文件"""
        try:
            self.SESSION_FILE.parent.mkdir(parents=True, exist_ok=True)
            session_data = {
                "collection_name": self.current_collection_name,
                "index_collection_name": self.index_collection_name,
                "indexed_doc_ids": list(self._indexed_doc_ids),
                "documents": [doc.to_dict() for doc in self.current_documents]
            }
            with open(self.SESSION_FILE, "w", encoding="utf-8") as f:
                json.dump(session_data, f, ensure_ascii=False, indent=2)
            logger.info(f"会话已保存: {len(self.current_documents)} 个文档")
        except Exception as e:
            logger.error(f"保存会话失败: {e}")
    
    def load_session(self):
        """从文件加载会话状态"""
        try:
            if not self.SESSION_FILE.exists():
                return
            
            with open(self.SESSION_FILE, "r", encoding="utf-8") as f:
                session_data = json.load(f)
            
            self.current_collection_name = session_data.get("collection_name")
            self.index_collection_name = session_data.get("index_collection_name")
            self._indexed_doc_ids = set(session_data.get("indexed_doc_ids", []))
            
            # 恢复文档
            docs_data = session_data.get("documents", [])
            for doc_dict in docs_data:
                try:
                    doc = DocumentInfo(
                        id=doc_dict["id"],
                        item_key=doc_dict["item_key"],
                        title=doc_dict["title"],
                        authors=doc_dict.get("authors", ""),
                        abstract=doc_dict.get("abstract"),
                        publication=doc_dict.get("publication"),
                        date=doc_dict.get("date"),
                        doi=doc_dict.get("doi"),
                        tags=doc_dict.get("tags", []),
                        pdf_path=Path(doc_dict["pdf_path"]) if doc_dict.get("pdf_path") else None,
                        has_pdf=doc_dict.get("has_pdf", False),
                        pdf_pages=doc_dict.get("pdf_pages", 0),
                        date_added=doc_dict.get("date_added")
                    )
                    self.current_documents.append(doc)
                    self.scanner._documents[doc.id] = doc
                except Exception as e:
                    logger.warning(f"恢复文档失败: {e}")
            
            logger.info(f"会话已恢复: {len(self.current_documents)} 个文档")
        except Exception as e:
            logger.error(f"加载会话失败: {e}")
    
    def get_request_cache(self, cache_key: str) -> Optional[Any]:
        """获取请求缓存"""
        if cache_key in self._request_cache:
            timestamp, result = self._request_cache[cache_key]
            if time.time() - timestamp < self._cache_ttl:
                return result
            del self._request_cache[cache_key]
        return None
    
    def set_request_cache(self, cache_key: str, result: Any):
        """设置请求缓存"""
        self._request_cache[cache_key] = (time.time(), result)
        # 清理过期缓存
        now = time.time()
        expired_keys = [k for k, (ts, _) in self._request_cache.items() if now - ts > self._cache_ttl]
        for k in expired_keys:
            del self._request_cache[k]


# 创建全局状态实例
state = GlobalState()


# ============ 全局异常处理中间件 ============
class ErrorHandlingMiddleware(BaseHTTPMiddleware):
    """全局异常处理中间件，统一错误响应格式"""
    
    async def dispatch(self, request: Request, call_next):
        try:
            response = await call_next(request)
            return response
        except Exception as e:
            logger.error(f"未处理的异常: {type(e).__name__}: {str(e)}", exc_info=True)
            return JSONResponse(
                status_code=500,
                content={
                    "error": "internal_error",
                    "message": "服务器内部错误，请稍后重试",
                    "detail": str(e) if get_settings().debug else None
                }
            )


# ============ 请求超时中间件 ============
class TimeoutMiddleware(BaseHTTPMiddleware):
    """请求超时中间件"""
    
    def __init__(self, app, timeout: int = 300):  # 默认5分钟超时
        super().__init__(app)
        self.timeout = timeout
    
    async def dispatch(self, request: Request, call_next):
        try:
            return await asyncio.wait_for(
                call_next(request),
                timeout=self.timeout
            )
        except asyncio.TimeoutError:
            logger.warning(f"请求超时: {request.url.path}")
            return JSONResponse(
                status_code=504,
                content={
                    "error": "timeout",
                    "message": "请求处理超时，请稍后重试"
                }
            )


# ============ 应用生命周期管理 ============
@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用启动和关闭时的资源管理"""
    # 启动时：加载持久化的会话数据
    logger.info("Zotero Chat API 启动中...")
    state.load_session()
    yield
    # 关闭时：保存会话数据
    logger.info("Zotero Chat API 关闭中...")
    state.save_session()


app = FastAPI(title="Zotero Chat API", lifespan=lifespan)

# 添加中间件（注意顺序：先添加的后执行）
# app.add_middleware(TimeoutMiddleware, timeout=300)  # 可选：5分钟超时
app.add_middleware(ErrorHandlingMiddleware)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class CollectionResponse(BaseModel):
    key: str
    name: str
    num_items: int
    parent_key: Optional[str] = None

# ============ 请求模型（带验证） ============
class ScanRequest(BaseModel):
    collection_name: str = Field(..., min_length=1, max_length=500)
    load_pdf: bool = True

class SummarizeRequest(BaseModel):
    doc_ids: List[str] = Field(..., min_length=1, max_length=100)
    summary_type: str = Field(default="full", pattern="^(full|quick|key_points)$")
    context_mode: str = Field(default="full", pattern="^(full|abstract)$")
    
    @field_validator('doc_ids')
    @classmethod
    def validate_doc_ids(cls, v):
        if not v:
            raise ValueError('至少需要选择一篇文献')
        if len(v) > 100:
            raise ValueError('最多同时处理100篇文献')
        return v
    
    @field_validator('context_mode')
    @classmethod
    def validate_context_mode(cls, v):
        value = (v or "full").lower()
        if value not in {"full", "abstract"}:
            raise ValueError('context_mode must be "full" or "abstract"')
        return value

class ResearchRequest(BaseModel):
    doc_ids: List[str] = Field(..., min_length=1, max_length=50)
    question: str = Field(..., min_length=5, max_length=2000)
    
    @field_validator('question')
    @classmethod
    def validate_question(cls, v):
        if len(v.strip()) < 5:
            raise ValueError('研究问题至少需要5个字符')
        return v.strip()

class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=10000)
    doc_ids: Optional[List[str]] = Field(default=None, max_length=500)
    history: List[Dict[str, str]] = Field(default=[], max_length=50)
    context_mode: str = Field(default="full", pattern="^(full|abstract)$")
    
    @field_validator('message')
    @classmethod
    def validate_message(cls, v):
        if not v.strip():
            raise ValueError('消息不能为空')
        return v.strip()
    
    @field_validator('context_mode')
    @classmethod
    def validate_context_mode(cls, v):
        value = (v or "full").lower()
        if value not in {"full", "abstract"}:
            raise ValueError('context_mode must be "full" or "abstract"')
        return value


class SearchRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=500)
    n_results: int = Field(default=10, ge=1, le=100)
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=40, ge=1, le=100)

@app.post("/api/search_zotero")
async def search_zotero(request: SearchRequest):
    try:
        print(f"API: Searching for '{request.query}' (full, local-first)")
        manager = state.scanner._collection_manager
        items = manager.search_items(request.query, limit=None, offset=0)
        source = "local_sqlite" if items and items[0].raw_data.get("source") == "local_sqlite" else "api_fallback"
        print(f"API: Found {len(items)} items from Zotero (source={source})")
        
        documents = []
        for item in items:
            # 获取第一个PDF附件（如果有）
            pdf_attachments = item.pdf_attachments
            attachment = None
            if pdf_attachments:
                # 优先解析本地路径，便于后续加载 PDF
                attachment = pdf_attachments[0]
                try:
                    resolved = manager.client.resolve_attachment_path(attachment)
                    if resolved:
                        attachment.path = resolved
                except Exception:
                    pass
            doc = DocumentInfo.from_item(item, attachment)
            documents.append(doc)
        
        # 按标题去重：保留有 PDF 的版本
        seen = {}
        for doc in documents:
            title_key = doc.title.strip().lower()
            if title_key not in seen:
                seen[title_key] = doc
            elif doc.has_pdf and not seen[title_key].has_pdf:
                # 新文档有 PDF，替换旧文档
                seen[title_key] = doc
        documents = list(seen.values())
        
        # 将搜索结果添加到扫描器缓存中，以便后续 AI 操作可以找到这些文档
        state.scanner.add_documents(documents)
        
        print(f"API: Returning {len(documents)} documents (after deduplication)")
        return {
            "documents": [d.to_dict() for d in documents],
            "collection_name": None,
            "page": 1,
            "page_size": len(documents),
            "has_more": False
        }
    except Exception as e:
        logger.error(f"Search failed: {e}")
        print(f"API Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class QuickCategorizeRequest(BaseModel):
    doc_ids: List[str] = Field(..., min_length=2, max_length=500)
    
    @field_validator('doc_ids')
    @classmethod
    def validate_doc_ids(cls, v):
        if len(v) < 2:
            raise ValueError('快速分类至少需要2篇文献')
        return v


# ============ 统一错误响应帮助函数 ============
def create_error_response(error_code: str, message: str, detail: str = None) -> dict:
    """创建统一格式的错误响应"""
    response = {
        "error": error_code,
        "message": message
    }
    if detail and get_settings().debug:
        response["detail"] = detail
    return response

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

def _get_documents_by_ids(doc_ids: List[str]) -> List[DocumentInfo]:
    """
    根据文档 ID 获取已扫描的文档，支持跨集合检索。
    优先返回已记录的文档对象，缺失时记录日志。
    """
    seen = set()
    found_docs: List[DocumentInfo] = []
    missing_ids: List[str] = []

    for doc_id in doc_ids:
        if doc_id in seen:
            continue
        seen.add(doc_id)

        doc = state.scanner.get_document(doc_id)
        if doc:
            found_docs.append(doc)
        else:
            missing_ids.append(doc_id)

    if missing_ids:
        logger.warning("未在已扫描文档中找到部分 ID: %s", missing_ids)

    if not found_docs:
        raise HTTPException(status_code=400, detail="No documents found with provided IDs")

    return found_docs


@app.post("/api/summarize")
def summarize_documents(request: SummarizeRequest):
    try:
        # Filter selected documents
        selected_docs = _get_documents_by_ids(request.doc_ids)
        
        if not selected_docs:
            raise HTTPException(status_code=400, detail="No documents found with provided IDs")

        # 按需加载 PDF 内容（全文模式）
        load_full_context = request.context_mode != "abstract"
        if load_full_context:
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
                        stream=True,
                        context_mode=request.context_mode
                    ):
                        yield f"data: {json.dumps({'type': 'content', 'content': chunk})}\n\n"
                else:
                    title = f"综合分析: {len(selected_docs)} 篇文献"
                    yield f"data: {json.dumps({'type': 'title', 'content': title})}\n\n"
                    for chunk in state.summarizer.summarize_multiple(
                        selected_docs,
                        stream=True,
                        context_mode=request.context_mode
                    ):
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
        selected_docs = _get_documents_by_ids(request.doc_ids)
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
def chat(request: ChatRequest):
    """
    对话式交互 - 支持流式输出
    """
    try:
        settings = get_settings()
        load_full_context = request.context_mode != "abstract"
        context_docs = None
        if request.doc_ids:
            context_docs = _get_documents_by_ids(request.doc_ids)
            if load_full_context:
                # 全文对话最多取配置数量，避免过大上下文
                max_full = max(settings.chat.max_full_docs, 1)
                context_docs = context_docs[:max_full]
            else:
                # 摘要对话可配置最大数量；None 表示不限制
                max_abs = settings.chat.max_abstract_docs
                if max_abs is not None and max_abs > 0:
                    context_docs = context_docs[:max_abs]
            # 按需加载 PDF 内容（全文模式）
            if load_full_context:
                context_docs = _ensure_pdf_loaded(context_docs)
        
        # 使用流式输出
        def generate():
            try:
                yield f"data: {json.dumps({'type': 'start'}, ensure_ascii=False)}\n\n"
                
                for chunk in state.summarizer.chat(
                    request.message,
                    context=context_docs,
                    history=request.history,
                    stream=True,
                    context_mode=request.context_mode
                ):
                    yield f"data: {json.dumps({'type': 'content', 'content': chunk}, ensure_ascii=False)}\n\n"
                
                yield f"data: {json.dumps({'type': 'done'}, ensure_ascii=False)}\n\n"
            except Exception as e:
                logger.error(f"Chat 流式生成错误: {type(e).__name__}: {str(e)}", exc_info=True)
                yield f"data: {json.dumps({'type': 'error', 'content': str(e)}, ensure_ascii=False)}\n\n"
        
        return StreamingResponse(generate(), media_type="text/event-stream")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Chat 错误: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/chat-sync")
async def chat_sync(request: ChatRequest):
    """
    对话式交互 - 同步版本（向后兼容）
    """
    try:
        settings = get_settings()
        load_full_context = request.context_mode != "abstract"
        context_docs = None
        if request.doc_ids:
            context_docs = _get_documents_by_ids(request.doc_ids)
            if load_full_context:
                max_full = max(settings.chat.max_full_docs, 1)
                context_docs = context_docs[:max_full]
            else:
                max_abs = settings.chat.max_abstract_docs
                if max_abs is not None and max_abs > 0:
                    context_docs = context_docs[:max_abs]
            if load_full_context:
                context_docs = _ensure_pdf_loaded(context_docs)
        
        response = state.summarizer.chat(
            request.message,
            context=context_docs,
            history=request.history,
            stream=False,
            context_mode=request.context_mode
        )
        return {"response": response}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Chat 错误: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/quick-categorize")
def quick_categorize(request: QuickCategorizeRequest):
    """
    快速分类汇总：仅使用文献摘要进行分类和汇总，无需加载 PDF 内容。
    适合快速了解一组文献的整体情况。
    """
    try:
        logger.info(f"快速分类请求: doc_ids={request.doc_ids}, 已缓存文档数={len(state.scanner.documents)}")
        
        selected_docs = _get_documents_by_ids(request.doc_ids)
        logger.info(f"找到匹配文档: {len(selected_docs)} 篇")
        
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
    支持增量索引，避免重复构建。
    """
    try:
        if not state.current_documents:
            raise HTTPException(
                status_code=400, 
                detail="请先扫描一个集合，然后再进行语义搜索"
            )

        try:
            with state._lock:  # 线程安全的索引操作
                # 检查是否需要重建索引
                need_rebuild = state.index_collection_name != state.current_collection_name
                
                if need_rebuild:
                    # 集合变更，重建索引
                    logger.info(f"集合变更，重建索引: {state.current_collection_name}")
                    state.index_manager.clear()
                    state._indexed_doc_ids.clear()
                    state.index_manager.add_documents(state.current_documents)
                    state._indexed_doc_ids = {doc.id for doc in state.current_documents}
                    state.index_collection_name = state.current_collection_name
                else:
                    # 同一集合，检查是否有新文档需要增量索引
                    current_ids = {doc.id for doc in state.current_documents}
                    new_ids = current_ids - state._indexed_doc_ids
                    
                    if new_ids:
                        new_docs = [doc for doc in state.current_documents if doc.id in new_ids]
                        logger.info(f"增量索引: {len(new_docs)} 个新文档")
                        state.index_manager.add_documents(new_docs)
                        state._indexed_doc_ids.update(new_ids)
                
                logger.info(
                    "索引状态: collection=%s, indexed=%d, total=%d",
                    state.current_collection_name,
                    len(state._indexed_doc_ids),
                    len(state.current_documents),
                )

            results: List[SearchResult] = state.index_manager.search(
                request.query,
                n_results=request.n_results,
            )
            
            # 直接返回结果数组，保持与前端的兼容性
            return results
        except ImportError as e:
            logger.error(f"chromadb 未安装: {e}")
            raise HTTPException(
                status_code=500,
                detail="语义搜索需要安装 chromadb，请运行: pip install chromadb",
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"语义搜索错误: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ============ 健康检查端点 ============
@app.get("/api/health")
async def health_check():
    """健康检查端点"""
    return {
        "status": "healthy",
        "documents_cached": len(state.current_documents),
        "collection": state.current_collection_name,
        "indexed_docs": len(state._indexed_doc_ids)
    }


@app.get("/api/pdf/{doc_id}")
async def serve_pdf(doc_id: str):
    """
    提供 PDF 文件下载/查看。
    根据文档 ID 获取 PDF 路径并返回文件。
    """
    try:
        doc = state.scanner.get_document(doc_id)
        if not doc:
            raise HTTPException(status_code=404, detail="文档未找到")
        
        pdf_path = doc.pdf_path

        # 如果未解析到路径，尝试按需解析附件路径
        if not pdf_path:
            try:
                attachments = state.scanner._collection_manager.client.get_item_attachments(doc.item_key)
                for att in attachments:
                    if att.is_pdf:
                        resolved = state.scanner._collection_manager.client.resolve_attachment_path(att)
                        if resolved and resolved.exists():
                            doc.pdf_path = resolved
                            doc.has_pdf = True
                            pdf_path = resolved
                            break
            except Exception as e:
                logger.warning(f"按需解析 PDF 路径失败: {e}")
        
        if not pdf_path:
            raise HTTPException(status_code=404, detail="该文档没有关联的 PDF 文件")
        
        pdf_path = Path(pdf_path) if isinstance(pdf_path, str) else pdf_path
        
        if not pdf_path.exists():
            raise HTTPException(status_code=404, detail=f"PDF 文件不存在: {pdf_path}")
        
        # 使用文档标题作为下载文件名（清理非法字符）
        safe_title = "".join(c for c in doc.title if c.isalnum() or c in (' ', '-', '_')).strip()
        filename = f"{safe_title[:50]}.pdf" if safe_title else "document.pdf"
        
        return FileResponse(
            path=str(pdf_path),
            media_type="application/pdf",
            filename=filename,
            headers={
                "Content-Disposition": f"inline; filename=\"{filename}\"",
                "Access-Control-Allow-Origin": "*"
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"提供 PDF 失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
