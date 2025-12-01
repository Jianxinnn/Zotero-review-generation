"""
向量索引管理
使用 ChromaDB 进行文档索引和语义搜索
"""

from pathlib import Path
from typing import List, Optional, Dict, Any

from pydantic import BaseModel, Field

from config import get_settings
from utils import get_logger
from .scanner import DocumentInfo

logger = get_logger(__name__)


class SearchResult(BaseModel):
    """搜索结果模型"""
    doc_id: str = Field(..., description="文档 ID")
    title: str = Field(..., description="文档标题")
    score: float = Field(..., description="相似度分数")
    content_snippet: str = Field(default="", description="匹配的内容片段")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="元数据")


class IndexManager:
    """索引管理器"""
    
    def __init__(
        self,
        persist_dir: Optional[Path] = None,
        collection_name: str = "zotero_docs"
    ):
        """
        初始化索引管理器
        
        Args:
            persist_dir: 索引持久化目录
            collection_name: 集合名称
        """
        settings = get_settings()
        self._persist_dir = Path(persist_dir or settings.index.persist_dir)
        self._collection_name = collection_name
        self._chunk_size = settings.index.chunk_size
        self._chunk_overlap = settings.index.chunk_overlap
        
        self._client = None
        self._collection = None
        self._initialized = False
    
    def _ensure_initialized(self) -> None:
        """确保索引已初始化"""
        if self._initialized:
            return
        
        try:
            import chromadb
            from chromadb.config import Settings
            
            # 确保目录存在
            self._persist_dir.mkdir(parents=True, exist_ok=True)
            
            # 初始化 ChromaDB
            self._client = chromadb.PersistentClient(
                path=str(self._persist_dir),
                settings=Settings(anonymized_telemetry=False)
            )
            
            # 获取或创建集合
            self._collection = self._client.get_or_create_collection(
                name=self._collection_name,
                metadata={"hnsw:space": "cosine"}
            )
            
            self._initialized = True
            logger.info(f"索引初始化完成: {self._persist_dir}")
            
        except ImportError:
            raise ImportError("请安装 chromadb: pip install chromadb")
        except Exception as e:
            logger.error(f"索引初始化失败: {e}")
            raise
    
    def add_documents(
        self,
        documents: List[DocumentInfo],
        on_progress: Optional[callable] = None
    ) -> int:
        """
        添加文档到索引
        
        Args:
            documents: 文档列表
            on_progress: 进度回调
            
        Returns:
            添加的文档数量
        """
        self._ensure_initialized()
        
        added = 0
        total = len(documents)
        
        for i, doc in enumerate(documents):
            try:
                # 准备文本内容
                text = doc.get_summary_text()
                if not text.strip():
                    continue
                
                # 分块
                chunks = self._chunk_text(text)
                if not chunks:
                    continue
                
                # 为每个块创建 ID 和元数据
                ids = [f"{doc.id}_chunk_{j}" for j in range(len(chunks))]
                metadatas = [
                    {
                        "doc_id": doc.id,
                        "title": doc.title,
                        "authors": doc.authors,
                        "chunk_index": j,
                        "total_chunks": len(chunks)
                    }
                    for j in range(len(chunks))
                ]
                
                # 添加到集合
                self._collection.add(
                    ids=ids,
                    documents=chunks,
                    metadatas=metadatas
                )
                
                added += 1
                
            except Exception as e:
                logger.warning(f"添加文档失败 {doc.id}: {e}")
            
            if on_progress:
                on_progress(i + 1, total, doc)
        
        logger.info(f"已添加 {added}/{total} 个文档到索引")
        return added
    
    def search(
        self,
        query: str,
        n_results: int = 10,
        filter_metadata: Optional[Dict[str, Any]] = None
    ) -> List[SearchResult]:
        """
        语义搜索
        
        Args:
            query: 搜索查询
            n_results: 返回结果数量
            filter_metadata: 元数据过滤条件
            
        Returns:
            搜索结果列表
        """
        self._ensure_initialized()
        
        try:
            results = self._collection.query(
                query_texts=[query],
                n_results=n_results,
                where=filter_metadata
            )
            
            search_results = []
            
            if results and results.get("ids"):
                for i, doc_id in enumerate(results["ids"][0]):
                    metadata = results["metadatas"][0][i] if results.get("metadatas") else {}
                    distance = results["distances"][0][i] if results.get("distances") else 0
                    document = results["documents"][0][i] if results.get("documents") else ""
                    
                    # 转换距离为相似度分数
                    score = 1 - distance
                    
                    search_results.append(SearchResult(
                        doc_id=metadata.get("doc_id", doc_id),
                        title=metadata.get("title", ""),
                        score=score,
                        content_snippet=document[:500] if document else "",
                        metadata=metadata
                    ))
            
            return search_results
            
        except Exception as e:
            logger.error(f"搜索失败: {e}")
            return []
    
    def get_document_chunks(self, doc_id: str) -> List[str]:
        """获取文档的所有分块"""
        self._ensure_initialized()
        
        try:
            results = self._collection.get(
                where={"doc_id": doc_id}
            )
            
            if results and results.get("documents"):
                # 按 chunk_index 排序
                chunks_with_index = []
                for i, doc in enumerate(results["documents"]):
                    metadata = results["metadatas"][i] if results.get("metadatas") else {}
                    index = metadata.get("chunk_index", i)
                    chunks_with_index.append((index, doc))
                
                chunks_with_index.sort(key=lambda x: x[0])
                return [c[1] for c in chunks_with_index]
            
            return []
            
        except Exception as e:
            logger.error(f"获取文档分块失败: {e}")
            return []
    
    def delete_document(self, doc_id: str) -> bool:
        """删除文档及其所有分块"""
        self._ensure_initialized()
        
        try:
            self._collection.delete(
                where={"doc_id": doc_id}
            )
            logger.info(f"已删除文档: {doc_id}")
            return True
        except Exception as e:
            logger.error(f"删除文档失败: {e}")
            return False
    
    def clear(self) -> None:
        """清空索引"""
        self._ensure_initialized()
        
        try:
            self._client.delete_collection(self._collection_name)
            self._collection = self._client.create_collection(
                name=self._collection_name,
                metadata={"hnsw:space": "cosine"}
            )
            logger.info("索引已清空")
        except Exception as e:
            logger.error(f"清空索引失败: {e}")
    
    def get_stats(self) -> Dict[str, Any]:
        """获取索引统计信息"""
        self._ensure_initialized()
        
        try:
            count = self._collection.count()
            return {
                "total_chunks": count,
                "collection_name": self._collection_name,
                "persist_dir": str(self._persist_dir)
            }
        except Exception as e:
            logger.error(f"获取统计信息失败: {e}")
            return {}
    
    def _chunk_text(self, text: str) -> List[str]:
        """将文本分割成块"""
        if not text:
            return []
        
        chunks = []
        start = 0
        
        while start < len(text):
            end = start + self._chunk_size
            
            # 尝试在句子边界分割
            if end < len(text):
                for sep in [". ", "。", "\n\n", "\n", " "]:
                    pos = text.rfind(sep, start + self._chunk_size // 2, end + 100)
                    if pos > start:
                        end = pos + len(sep)
                        break
            
            chunk = text[start:end].strip()
            if chunk:
                chunks.append(chunk)
            
            start = end - self._chunk_overlap
            if start >= len(text):
                break
        
        return chunks
