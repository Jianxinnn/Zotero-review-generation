"""
文档扫描器
扫描 Zotero 集合并建立文档信息
"""

from pathlib import Path
from typing import List, Optional, Dict, Any
from datetime import datetime

from pydantic import BaseModel, Field

from zotero import ZoteroClient, CollectionManager, Item, Attachment
from utils import PDFReader, PDFContent, get_logger

logger = get_logger(__name__)


class DocumentInfo(BaseModel):
    """文档信息模型，整合 Zotero 元数据和 PDF 内容"""
    
    # 基本标识
    id: str = Field(..., description="文档唯一标识")
    item_key: str = Field(..., description="Zotero 条目 key")
    
    # 文献元数据
    title: str = Field(..., description="标题")
    authors: str = Field(default="", description="作者")
    abstract: Optional[str] = Field(default=None, description="摘要")
    publication: Optional[str] = Field(default=None, description="期刊/出版物")
    date: Optional[str] = Field(default=None, description="发表日期")
    doi: Optional[str] = Field(default=None, description="DOI")
    tags: List[str] = Field(default_factory=list, description="标签")
    
    # PDF 信息
    pdf_path: Optional[Path] = Field(default=None, description="PDF 文件路径")
    pdf_content: Optional[str] = Field(default=None, description="PDF 文本内容")
    pdf_pages: int = Field(default=0, description="PDF 页数")
    
    # 状态
    has_pdf: bool = Field(default=False, description="是否有 PDF")
    pdf_loaded: bool = Field(default=False, description="PDF 内容是否已加载")
    
    # 时间戳
    scanned_at: datetime = Field(default_factory=datetime.now, description="扫描时间")
    date_added: Optional[str] = Field(default=None, description="添加日期")
    
    @classmethod
    def from_item(cls, item: Item, attachment: Optional[Attachment] = None) -> "DocumentInfo":
        """从 Zotero Item 创建"""
        doc_id = f"{item.key}"
        if attachment:
            doc_id = f"{item.key}_{attachment.key}"
        
        # Format date_added if present
        date_added_str = None
        if item.date_added:
            try:
                date_added_str = item.date_added.isoformat()
            except:
                pass

        return cls(
            id=doc_id,
            item_key=item.key,
            title=item.title,
            authors=item.authors_str,
            abstract=item.abstract,
            publication=item.publication,
            date=item.date,
            doi=item.doi,
            tags=item.tags,
            pdf_path=attachment.path if attachment and attachment.path else None,
            # 只要存在 PDF 附件就标记为有 PDF，即便路径待解析
            has_pdf=attachment is not None,
            date_added=date_added_str
        )
    
    def get_summary_text(self) -> str:
        """获取用于摘要的文本"""
        parts = []
        
        if self.title:
            parts.append(f"Title: {self.title}")
        if self.authors:
            parts.append(f"Authors: {self.authors}")
        if self.abstract:
            parts.append(f"Abstract: {self.abstract}")
        if self.pdf_content:
            # 限制长度
            content = self.pdf_content[:10000]
            parts.append(f"Content: {content}")
        
        return "\n\n".join(parts)
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "id": self.id,
            "item_key": self.item_key,
            "title": self.title,
            "authors": self.authors,
            "abstract": self.abstract,
            "publication": self.publication,
            "date": self.date,
            "doi": self.doi,
            "tags": self.tags,
            "pdf_path": str(self.pdf_path) if self.pdf_path else None,
            "has_pdf": self.has_pdf,
            "pdf_pages": self.pdf_pages,
            "date_added": self.date_added,
            "scanned_at": self.scanned_at.isoformat() if self.scanned_at else None,
            "pdf_loaded": self.pdf_loaded
        }


class DocumentScanner:
    """文档扫描器"""
    
    def __init__(
        self,
        client: Optional[ZoteroClient] = None,
        pdf_reader: Optional[PDFReader] = None
    ):
        """
        初始化扫描器
        
        Args:
            client: Zotero 客户端
            pdf_reader: PDF 读取器
        """
        self._collection_manager = CollectionManager(client)
        self._pdf_reader = pdf_reader or PDFReader()
        self._documents: Dict[str, DocumentInfo] = {}
    
    @property
    def documents(self) -> List[DocumentInfo]:
        """获取所有已扫描的文档"""
        return list(self._documents.values())
    
    def scan_collection(
        self,
        collection_name: str,
        include_subcollections: bool = False,
        load_pdf_content: bool = False,
        on_progress: Optional[callable] = None
    ) -> List[DocumentInfo]:
        """
        扫描指定集合
        
        Args:
            collection_name: 集合名称
            include_subcollections: 是否包含子集合
            load_pdf_content: 是否立即加载 PDF 内容
            on_progress: 进度回调 (current, total, doc_info)
            
        Returns:
            文档信息列表
        """
        logger.info(f"开始扫描集合: {collection_name}")
        
        # 获取集合中的所有条目
        items = self._collection_manager.get_collection_items(
            collection_name,
            include_subcollections=include_subcollections,
            pdf_only=False
        )
        
        total = len(items)
        logger.info(f"找到 {total} 个条目")
        
        documents = []
        
        for i, item in enumerate(items):
            # 查找 PDF 附件
            pdf_attachment = None
            pdf_path = None
            
            if item.has_pdf:
                for att in item.pdf_attachments:
                    # 使用 client 解析路径
                    path = self._collection_manager.client.resolve_attachment_path(att)
                    if path and path.exists():
                        pdf_attachment = att
                        pdf_path = path
                        break
            
            # 创建文档信息
            doc = DocumentInfo.from_item(item, pdf_attachment)
            
            # 加载 PDF 内容
            if load_pdf_content and doc.has_pdf and pdf_path:
                try:
                    pdf_content = self._pdf_reader.read(pdf_path)
                    doc.pdf_content = pdf_content.text
                    doc.pdf_pages = pdf_content.num_pages
                    doc.pdf_loaded = True
                    logger.debug(f"已加载 PDF: {doc.title}")
                except Exception as e:
                    logger.warning(f"加载 PDF 失败 {pdf_path}: {e}")
            
            documents.append(doc)
            self._documents[doc.id] = doc
            
            if on_progress:
                on_progress(i + 1, total, doc)
        
        logger.info(f"扫描完成，共 {len(documents)} 个文档")
        return documents
    
    def load_pdf_content(
        self,
        doc_id: str
    ) -> Optional[PDFContent]:
        """
        加载指定文档的 PDF 内容
        
        Args:
            doc_id: 文档 ID
            
        Returns:
            PDF 内容，如果加载失败返回 None
        """
        doc = self._documents.get(doc_id)
        if not doc:
            logger.warning(f"文档不存在: {doc_id}")
            return None
        
        if not doc.has_pdf or not doc.pdf_path:
            # 尝试按需解析附件（针对搜索结果等未预加载附件的情况）
            logger.info(f"文档 {doc.title} 缺少 PDF 信息，尝试按需解析...")
            try:
                attachments = self._collection_manager.client.get_item_attachments(doc.item_key)
                pdf_attachment = None
                for att in attachments:
                    if att.is_pdf:
                        # 解析路径
                        path = self._collection_manager.client.resolve_attachment_path(att)
                        if path and path.exists():
                            pdf_attachment = att
                            doc.pdf_path = path
                            doc.has_pdf = True
                            logger.info(f"成功解析到 PDF: {path}")
                            break
                
                if not pdf_attachment:
                    logger.warning(f"文档没有 PDF: {doc_id}")
                    return None
            except Exception as e:
                logger.error(f"按需解析附件失败: {e}")
                return None
        
        try:
            pdf_content = self._pdf_reader.read(doc.pdf_path)
            doc.pdf_content = pdf_content.text
            doc.pdf_pages = pdf_content.num_pages
            doc.pdf_loaded = True
            return pdf_content
        except Exception as e:
            logger.error(f"加载 PDF 失败: {e}")
            return None
    
    def load_all_pdf_contents(
        self,
        on_progress: Optional[callable] = None
    ) -> int:
        """
        加载所有文档的 PDF 内容
        
        Args:
            on_progress: 进度回调
            
        Returns:
            成功加载的数量
        """
        docs_with_pdf = [d for d in self.documents if d.has_pdf and not d.pdf_loaded]
        total = len(docs_with_pdf)
        loaded = 0
        
        for i, doc in enumerate(docs_with_pdf):
            result = self.load_pdf_content(doc.id)
            if result:
                loaded += 1
            
            if on_progress:
                on_progress(i + 1, total, doc)
        
        return loaded
    
    def get_document(self, doc_id: str) -> Optional[DocumentInfo]:
        """获取指定文档"""
        return self._documents.get(doc_id)
    
    def add_documents(self, docs: List[DocumentInfo]) -> None:
        """手动添加文档到缓存（用于搜索结果等）"""
        for doc in docs:
            self._documents[doc.id] = doc

    def search(
        self,
        query: Optional[str] = None,
        tags: Optional[List[str]] = None,
        keywords: Optional[List[str]] = None
    ) -> List[DocumentInfo]:
        """
        搜索已扫描的文档
        
        Args:
            query: 搜索关键词
            tags: 标签过滤
            keywords: 关键词过滤
            
        Returns:
            匹配的文档列表
        """
        results = list(self._documents.values())
        
        if query:
            q = query.lower()
            results = [
                d for d in results
                if q in d.title.lower() or 
                   q in d.authors.lower() or 
                   (d.abstract and q in d.abstract.lower())
            ]
        
        if tags:
            tags_lower = [t.lower() for t in tags]
            results = [
                d for d in results
                if any(t.lower() in tags_lower for t in d.tags)
            ]
        
        if keywords:
            def matches_keywords(doc: DocumentInfo) -> bool:
                text = f"{doc.title} {doc.abstract or ''} {doc.authors}".lower()
                return all(kw.lower() in text for kw in keywords)
            results = [d for d in results if matches_keywords(d)]
        
        return results
    
    def filter_documents(
        self,
        has_pdf: Optional[bool] = None,
        pdf_loaded: Optional[bool] = None,
        tags: Optional[List[str]] = None,
        keywords: Optional[List[str]] = None
    ) -> List[DocumentInfo]:
        """
        过滤文档
        
        Args:
            has_pdf: 是否有 PDF
            pdf_loaded: PDF 是否已加载
            tags: 标签过滤
            keywords: 关键词过滤
            
        Returns:
            过滤后的文档列表
        """
        results = list(self.documents)
        
        if has_pdf is not None:
            results = [d for d in results if d.has_pdf == has_pdf]
        
        if pdf_loaded is not None:
            results = [d for d in results if d.pdf_loaded == pdf_loaded]
        
        if tags:
            tags_lower = [t.lower() for t in tags]
            results = [
                d for d in results
                if any(t.lower() in tags_lower for t in d.tags)
            ]
        
        if keywords:
            def matches_keywords(doc: DocumentInfo) -> bool:
                text = f"{doc.title} {doc.abstract or ''} {doc.authors}".lower()
                return all(kw.lower() in text for kw in keywords)
            results = [d for d in results if matches_keywords(d)]
        
        return results
    
    def clear(self) -> None:
        """清空扫描结果"""
        self._documents.clear()
    
    def get_statistics(self) -> Dict[str, Any]:
        """获取扫描统计信息"""
        docs = self.documents
        return {
            "total_documents": len(docs),
            "with_pdf": sum(1 for d in docs if d.has_pdf),
            "pdf_loaded": sum(1 for d in docs if d.pdf_loaded),
            "total_pages": sum(d.pdf_pages for d in docs),
            "unique_tags": list(set(
                tag for d in docs for tag in d.tags
            ))
        }
