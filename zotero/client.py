"""
Zotero API 客户端
提供与 Zotero 服务器的 API 交互
"""

import concurrent.futures
from pathlib import Path
from typing import List, Dict, Any, Optional

from pyzotero import zotero

from config import get_settings
from .models import Collection, Item, Attachment


class ZoteroClient:
    """Zotero API 客户端"""
    
    def __init__(
        self,
        library_id: Optional[str] = None,
        library_type: Optional[str] = None,
        api_key: Optional[str] = None,
        data_dir: Optional[Path] = None
    ):
        """
        初始化 Zotero 客户端
        
        Args:
            library_id: Zotero Library ID
            library_type: Library 类型 (user/group)
            api_key: Zotero API Key
            data_dir: 本地 Zotero 数据目录
        """
        settings = get_settings()
        
        self.library_id = library_id or settings.zotero.library_id
        self.library_type = library_type or settings.zotero.library_type
        self.api_key = api_key or settings.zotero.api_key
        self.data_dir = Path(data_dir or settings.zotero.data_dir)
        
        # 初始化 pyzotero 客户端
        self._client: Optional[zotero.Zotero] = None
        
    @property
    def client(self) -> zotero.Zotero:
        """延迟初始化 Zotero 客户端"""
        if self._client is None:
            if not self.library_id or not self.api_key:
                raise ValueError("Zotero library_id 和 api_key 是必需的")
            self._client = zotero.Zotero(
                self.library_id,
                self.library_type,
                self.api_key
            )
        return self._client
    
    def get_collections(self) -> List[Collection]:
        """获取所有集合（自动处理分页，获取全部）"""
        # pyzotero 的 everything() 方法会自动处理分页
        raw_collections = self.client.everything(self.client.collections())
        return [self._parse_collection(c) for c in raw_collections]
    
    def get_collection_by_name(self, name: str) -> Optional[Collection]:
        """
        根据名称获取集合
        
        Args:
            name: 集合名称(支持模糊匹配)
            
        Returns:
            匹配的集合，如果没找到返回 None
        """
        collections = self.get_collections()
        
        # 精确匹配
        for col in collections:
            if col.name == name:
                return col
        
        # 模糊匹配(不区分大小写)
        name_lower = name.lower()
        for col in collections:
            if name_lower in col.name.lower():
                return col
        
        return None
    
    def get_collection_items(self, collection_key: str) -> List[Item]:
        """
        获取集合中的所有条目
        
        Args:
            collection_key: 集合的 key
            
        Returns:
            条目列表
        """
        # 使用 everything() 自动处理分页，确保获取集合内的全部条目
        raw_items = self.client.everything(
            self.client.collection_items(collection_key)
        )
        items = []
        
        # 先解析所有条目（不含附件）
        for raw_item in raw_items:
            if raw_item.get("data", {}).get("itemType") != "attachment":
                item = self._parse_item(raw_item)
                items.append(item)
        
        # 并发获取所有附件信息
        if items:
            with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
                future_to_item = {
                    executor.submit(self.get_item_attachments, item.key): item
                    for item in items
                }
                for future in concurrent.futures.as_completed(future_to_item):
                    item = future_to_item[future]
                    try:
                        item.attachments = future.result()
                    except Exception:
                        item.attachments = []
        
        return items
    
    def get_item_attachments(self, item_key: str) -> List[Attachment]:
        """
        获取条目的附件
        
        Args:
            item_key: 条目的 key
            
        Returns:
            附件列表
        """
        try:
            raw_attachments = self.client.children(item_key)
            attachments = []
            
            for raw_att in raw_attachments:
                data = raw_att.get("data", {})
                if data.get("itemType") == "attachment":
                    att = self._parse_attachment(data)
                    attachments.append(att)
            
            return attachments
        except Exception:
            return []

    def search_items(self, query: str, limit: int = 50) -> List[Item]:
        """
        搜索条目
        
        Args:
            query: 搜索关键词
            limit: 最大返回数量
            
        Returns:
            条目列表
        """
        # 使用 items(q=query, limit=limit) 进行搜索
        # itemType="-attachment" 排除附件，只搜索父条目
        # qmode="everything" 确保搜索范围最广
        raw_items = self.client.items(
            q=query, 
            qmode="everything", 
            limit=limit, 
            itemType="-attachment"
        )
        items = [self._parse_item(i) for i in raw_items]
        
        # 优化：搜索时不并发获取附件，以提高响应速度
        # 附件信息将在需要时（如加载 PDF）按需获取
        
        return items

    
    def get_all_items(self, limit: int = 100) -> List[Item]:
        """获取所有条目"""
        raw_items = self.client.top(limit=limit)
        items = []
        
        # 先解析所有条目
        for raw_item in raw_items:
            item = self._parse_item(raw_item)
            items.append(item)
        
        # 并发获取附件
        if items:
            with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
                future_to_item = {
                    executor.submit(self.get_item_attachments, item.key): item
                    for item in items
                }
                for future in concurrent.futures.as_completed(future_to_item):
                    item = future_to_item[future]
                    try:
                        item.attachments = future.result()
                    except Exception:
                        item.attachments = []
        
        return items
    
    
    def _parse_collection(self, raw: Dict[str, Any]) -> Collection:
        """解析集合数据"""
        data = raw.get("data", {})
        meta = raw.get("meta", {})
        
        return Collection(
            key=data.get("key", ""),
            name=data.get("name", ""),
            parent_key=data.get("parentCollection") or None,
            num_items=meta.get("numItems", 0),
            num_collections=meta.get("numCollections", 0)
        )
    
    def _parse_item(self, raw: Dict[str, Any]) -> Item:
        """解析条目数据"""
        data = raw.get("data", {})
        
        # 解析标签
        tags = [t.get("tag", "") for t in data.get("tags", [])]
        
        # 解析日期
        date_added = None
        date_modified = None
        try:
            if data.get("dateAdded"):
                from datetime import datetime
                date_added = datetime.fromisoformat(data["dateAdded"].replace("Z", "+00:00"))
            if data.get("dateModified"):
                date_modified = datetime.fromisoformat(data["dateModified"].replace("Z", "+00:00"))
        except Exception:
            pass
        
        return Item(
            key=data.get("key", ""),
            item_type=data.get("itemType", ""),
            title=data.get("title", ""),
            creators=data.get("creators", []),
            abstract=data.get("abstractNote"),
            date=data.get("date"),
            publication=data.get("publicationTitle") or data.get("journalAbbreviation"),
            doi=data.get("DOI"),
            url=data.get("url"),
            tags=tags,
            collections=data.get("collections", []),
            date_added=date_added,
            date_modified=date_modified,
            raw_data=data
        )
    
    def _parse_attachment(self, data: Dict[str, Any]) -> Attachment:
        """解析附件数据"""
        filename = data.get("filename")
        key = data.get("key", "")
        
        # 构建本地文件路径
        local_path = None
        if filename and self.data_dir:
            # Zotero 存储路径格式: storage/<key>/<filename>
            storage_path = self.data_dir / "storage" / key / filename
            if storage_path.exists():
                local_path = storage_path
        
        return Attachment(
            key=key,
            title=data.get("title", ""),
            filename=filename,
            content_type=data.get("contentType"),
            path=local_path,
            link_mode=data.get("linkMode", "")
        )
    
    def resolve_attachment_path(self, attachment: Attachment) -> Optional[Path]:
        """
        解析附件的本地路径
        
        Args:
            attachment: 附件对象
            
        Returns:
            本地文件路径，如果找不到返回 None
        """
        if attachment.path and attachment.path.exists():
            return attachment.path
        
        if attachment.filename:
            storage_path = self.data_dir / "storage" / attachment.key / attachment.filename
            if storage_path.exists():
                return storage_path
        
        return None
