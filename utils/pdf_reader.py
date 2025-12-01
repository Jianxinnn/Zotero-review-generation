"""
PDF 读取和文本提取模块
"""

import re
from pathlib import Path
from typing import Optional, List, Dict, Any

from pydantic import BaseModel, Field

from .logger import get_logger

logger = get_logger(__name__)


class PDFContent(BaseModel):
    """PDF 内容模型"""
    path: Path = Field(..., description="文件路径")
    title: str = Field(default="", description="文档标题")
    text: str = Field(default="", description="提取的文本内容")
    pages: List[str] = Field(default_factory=list, description="按页分割的文本")
    num_pages: int = Field(default=0, description="总页数")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="PDF 元数据")
    
    @property
    def word_count(self) -> int:
        """统计词数"""
        return len(self.text.split())
    
    @property
    def char_count(self) -> int:
        """统计字符数"""
        return len(self.text)
    
    def get_page_range(self, start: int, end: int) -> str:
        """获取指定页范围的文本"""
        if not self.pages:
            return ""
        start = max(0, start)
        end = min(len(self.pages), end)
        return "\n".join(self.pages[start:end])
    
    def get_chunks(self, chunk_size: int = 1000, overlap: int = 200) -> List[str]:
        """
        将文本分割成块
        
        Args:
            chunk_size: 每块的字符数
            overlap: 块之间的重叠字符数
            
        Returns:
            文本块列表
        """
        if not self.text:
            return []
        
        chunks = []
        text = self.text
        start = 0
        
        while start < len(text):
            end = start + chunk_size
            
            # 尝试在句子边界分割
            if end < len(text):
                # 向后查找句子结束
                for sep in [". ", "。", "\n\n", "\n"]:
                    pos = text.rfind(sep, start + chunk_size // 2, end + 100)
                    if pos > start:
                        end = pos + len(sep)
                        break
            
            chunk = text[start:end].strip()
            if chunk:
                chunks.append(chunk)
            
            start = end - overlap
            if start >= len(text):
                break
        
        return chunks


class PDFReader:
    """PDF 读取器"""
    
    def __init__(self, use_pymupdf: bool = True):
        """
        初始化 PDF 读取器
        
        Args:
            use_pymupdf: 是否使用 PyMuPDF (fitz)，否则使用 pdfplumber
        """
        self.use_pymupdf = use_pymupdf
    
    def read(self, path: Path) -> PDFContent:
        """
        读取 PDF 文件
        
        Args:
            path: PDF 文件路径
            
        Returns:
            PDF 内容对象
        """
        path = Path(path)
        if not path.exists():
            raise FileNotFoundError(f"PDF 文件不存在: {path}")
        
        if not path.suffix.lower() == ".pdf":
            raise ValueError(f"不是 PDF 文件: {path}")
        
        if self.use_pymupdf:
            return self._read_with_pymupdf(path)
        else:
            return self._read_with_pdfplumber(path)
    
    def _read_with_pymupdf(self, path: Path) -> PDFContent:
        """使用 PyMuPDF 读取"""
        try:
            import fitz
        except ImportError:
            logger.warning("PyMuPDF 未安装，尝试使用 pdfplumber")
            return self._read_with_pdfplumber(path)
        
        try:
            doc = fitz.open(str(path))
            
            pages = []
            for page_num in range(len(doc)):
                page = doc[page_num]
                text = page.get_text()
                pages.append(text)
            
            full_text = "\n\n".join(pages)
            full_text = self._clean_text(full_text)
            
            # 提取元数据
            metadata = dict(doc.metadata) if doc.metadata else {}
            title = metadata.get("title", "") or path.stem
            
            doc.close()
            
            return PDFContent(
                path=path,
                title=title,
                text=full_text,
                pages=[self._clean_text(p) for p in pages],
                num_pages=len(pages),
                metadata=metadata
            )
            
        except Exception as e:
            logger.error(f"PyMuPDF 读取失败: {e}")
            raise
    
    def _read_with_pdfplumber(self, path: Path) -> PDFContent:
        """使用 pdfplumber 读取"""
        try:
            import pdfplumber
        except ImportError:
            raise ImportError("请安装 pdfplumber: pip install pdfplumber")
        
        try:
            pages = []
            metadata = {}
            
            with pdfplumber.open(str(path)) as pdf:
                metadata = pdf.metadata or {}
                
                for page in pdf.pages:
                    text = page.extract_text() or ""
                    pages.append(text)
            
            full_text = "\n\n".join(pages)
            full_text = self._clean_text(full_text)
            
            title = metadata.get("Title", "") or path.stem
            
            return PDFContent(
                path=path,
                title=title,
                text=full_text,
                pages=[self._clean_text(p) for p in pages],
                num_pages=len(pages),
                metadata=metadata
            )
            
        except Exception as e:
            logger.error(f"pdfplumber 读取失败: {e}")
            raise
    
    def _clean_text(self, text: str) -> str:
        """清理提取的文本"""
        if not text:
            return ""
        
        # 移除多余的空白
        text = re.sub(r'\n{3,}', '\n\n', text)
        text = re.sub(r' {2,}', ' ', text)
        
        # 移除页眉页脚常见模式 (简单处理)
        # 这里可以根据需要增加更多规则
        
        return text.strip()
    
    def read_batch(
        self,
        paths: List[Path],
        on_progress: Optional[callable] = None
    ) -> List[PDFContent]:
        """
        批量读取 PDF 文件
        
        Args:
            paths: PDF 文件路径列表
            on_progress: 进度回调函数
            
        Returns:
            PDF 内容列表
        """
        results = []
        total = len(paths)
        
        for i, path in enumerate(paths):
            try:
                content = self.read(path)
                results.append(content)
                
                if on_progress:
                    on_progress(i + 1, total, path, True)
                    
            except Exception as e:
                logger.warning(f"读取失败 {path}: {e}")
                if on_progress:
                    on_progress(i + 1, total, path, False)
        
        return results
