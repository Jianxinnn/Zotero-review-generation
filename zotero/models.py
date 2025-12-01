"""
Zotero 数据模型
"""

from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict, Any

from pydantic import BaseModel, Field


class Attachment(BaseModel):
    """Zotero 附件模型"""
    key: str = Field(..., description="附件唯一标识")
    title: str = Field(default="", description="附件标题")
    filename: Optional[str] = Field(default=None, description="文件名")
    content_type: Optional[str] = Field(default=None, description="MIME 类型")
    path: Optional[Path] = Field(default=None, description="本地文件路径")
    link_mode: str = Field(default="", description="链接模式")
    
    @property
    def is_pdf(self) -> bool:
        """判断是否为 PDF 文件"""
        if self.content_type:
            return self.content_type == "application/pdf"
        if self.filename:
            return self.filename.lower().endswith(".pdf")
        return False
    
    @property
    def exists(self) -> bool:
        """检查文件是否存在"""
        return self.path is not None and self.path.exists()


class Item(BaseModel):
    """Zotero 文献条目模型"""
    key: str = Field(..., description="条目唯一标识")
    item_type: str = Field(..., description="条目类型")
    title: str = Field(default="", description="标题")
    creators: List[Dict[str, str]] = Field(default_factory=list, description="作者列表")
    abstract: Optional[str] = Field(default=None, description="摘要")
    date: Optional[str] = Field(default=None, description="发表日期")
    publication: Optional[str] = Field(default=None, description="期刊/出版物")
    doi: Optional[str] = Field(default=None, description="DOI")
    url: Optional[str] = Field(default=None, description="URL")
    tags: List[str] = Field(default_factory=list, description="标签列表")
    collections: List[str] = Field(default_factory=list, description="所属集合")
    attachments: List[Attachment] = Field(default_factory=list, description="附件列表")
    date_added: Optional[datetime] = Field(default=None, description="添加日期")
    date_modified: Optional[datetime] = Field(default=None, description="修改日期")
    
    # 额外的原始数据
    raw_data: Dict[str, Any] = Field(default_factory=dict, description="原始数据")
    
    @property
    def authors_str(self) -> str:
        """格式化作者列表为字符串"""
        authors = []
        for creator in self.creators:
            if creator.get("creatorType") == "author":
                name = creator.get("name") or f"{creator.get('firstName', '')} {creator.get('lastName', '')}".strip()
                if name:
                    authors.append(name)
        return ", ".join(authors) if authors else "Unknown"
    
    @property
    def pdf_attachments(self) -> List[Attachment]:
        """获取所有 PDF 附件"""
        return [att for att in self.attachments if att.is_pdf]
    
    @property
    def has_pdf(self) -> bool:
        """检查是否有 PDF 附件"""
        return len(self.pdf_attachments) > 0
    
    def get_citation(self) -> str:
        """生成简单引用格式"""
        parts = [self.authors_str]
        if self.date:
            parts.append(f"({self.date})")
        parts.append(self.title)
        if self.publication:
            parts.append(self.publication)
        return ". ".join(parts)


class Collection(BaseModel):
    """Zotero 集合(文件夹)模型"""
    key: str = Field(..., description="集合唯一标识")
    name: str = Field(..., description="集合名称")
    parent_key: Optional[str] = Field(default=None, description="父集合 key")
    items: List[Item] = Field(default_factory=list, description="集合中的条目")
    sub_collections: List["Collection"] = Field(default_factory=list, description="子集合")
    
    # 元信息
    num_items: int = Field(default=0, description="条目数量")
    num_collections: int = Field(default=0, description="子集合数量")
    
    @property
    def pdf_items(self) -> List[Item]:
        """获取所有包含 PDF 的条目"""
        return [item for item in self.items if item.has_pdf]
    
    def get_all_items(self, include_subcollections: bool = True) -> List[Item]:
        """获取所有条目，可选包含子集合"""
        all_items = list(self.items)
        if include_subcollections:
            for sub in self.sub_collections:
                all_items.extend(sub.get_all_items(include_subcollections=True))
        return all_items


class SearchQuery(BaseModel):
    """搜索查询参数"""
    collection_name: Optional[str] = Field(default=None, description="集合名称")
    keywords: Optional[List[str]] = Field(default=None, description="关键词列表")
    authors: Optional[List[str]] = Field(default=None, description="作者筛选")
    tags: Optional[List[str]] = Field(default=None, description="标签筛选")
    date_from: Optional[str] = Field(default=None, description="起始日期")
    date_to: Optional[str] = Field(default=None, description="结束日期")
    item_types: Optional[List[str]] = Field(default=None, description="条目类型筛选")
    has_pdf: bool = Field(default=False, description="只返回有 PDF 的条目")
