"""
集合管理器
提供更高层的集合操作接口
"""

from pathlib import Path
from typing import List, Dict, Optional, Callable

from .client import ZoteroClient
from .models import Collection, Item, Attachment, SearchQuery


class CollectionManager:
    """集合管理器，提供高级集合操作"""
    
    def __init__(self, client: Optional[ZoteroClient] = None):
        """
        初始化集合管理器
        
        Args:
            client: Zotero 客户端实例
        """
        self._client = client or ZoteroClient()
        self._collections_cache: Optional[Dict[str, Collection]] = None
        self._items_cache: Dict[str, List[Item]] = {}
    
    @property
    def client(self) -> ZoteroClient:
        """获取 Zotero 客户端"""
        return self._client
    
    def refresh_cache(self) -> None:
        """刷新缓存"""
        self._collections_cache = None
        self._items_cache.clear()
    
    def get_all_collections(self, use_cache: bool = True) -> List[Collection]:
        """
        获取所有集合
        
        Args:
            use_cache: 是否使用缓存
            
        Returns:
            集合列表
        """
        if use_cache and self._collections_cache is not None:
            return list(self._collections_cache.values())
        
        collections = self._client.get_collections()
        self._collections_cache = {c.key: c for c in collections}
        return collections
    
    def get_collection_by_name(
        self,
        name: str,
        exact_match: bool = False
    ) -> Optional[Collection]:
        """
        根据名称查找集合
        
        Args:
            name: 集合名称
            exact_match: 是否精确匹配
            
        Returns:
            匹配的集合
        """
        collections = self.get_all_collections()
        
        if exact_match:
            for col in collections:
                if col.name == name:
                    return col
        else:
            name_lower = name.lower()
            # 先尝试精确匹配
            for col in collections:
                if col.name.lower() == name_lower:
                    return col
            # 再尝试包含匹配
            for col in collections:
                if name_lower in col.name.lower():
                    return col
        
        return None
    
    def get_collection_items(
        self,
        collection_name: str,
        include_subcollections: bool = False,
        pdf_only: bool = False,
        use_cache: bool = True
    ) -> List[Item]:
        """
        获取指定集合中的所有条目
        
        Args:
            collection_name: 集合名称
            include_subcollections: 是否包含子集合
            pdf_only: 是否只返回有 PDF 的条目
            use_cache: 是否使用缓存
            
        Returns:
            条目列表
        """
        collection = self.get_collection_by_name(collection_name)
        if not collection:
            raise ValueError(f"未找到集合: {collection_name}")
        
        cache_key = f"{collection.key}:{include_subcollections}"
        
        if use_cache and cache_key in self._items_cache:
            items = self._items_cache[cache_key]
        else:
            items = self._client.get_collection_items(collection.key)
            
            if include_subcollections:
                # 获取子集合
                all_collections = self.get_all_collections()
                sub_collections = self._get_subcollections(collection.key, all_collections)
                
                for sub_col in sub_collections:
                    sub_items = self._client.get_collection_items(sub_col.key)
                    items.extend(sub_items)
            
            self._items_cache[cache_key] = items
        
        if pdf_only:
            items = [item for item in items if item.has_pdf]
        
        return items

    def search_items(self, query: str, limit: int = 50) -> List[Item]:
        """
        搜索条目
        
        Args:
            query: 搜索关键词
            limit: 最大返回数量
            
        Returns:
            条目列表
        """
        return self._client.search_items(query, limit)
    
    def _get_subcollections(
        self,
        parent_key: str,
        all_collections: List[Collection]
    ) -> List[Collection]:
        """递归获取所有子集合"""
        result = []
        for col in all_collections:
            if col.parent_key == parent_key:
                result.append(col)
                result.extend(self._get_subcollections(col.key, all_collections))
        return result
    
    def get_pdf_files(
        self,
        collection_name: str,
        include_subcollections: bool = False
    ) -> List[Dict[str, any]]:
        """
        获取集合中所有 PDF 文件的路径和元信息
        
        Args:
            collection_name: 集合名称
            include_subcollections: 是否包含子集合
            
        Returns:
            PDF 文件信息列表，每项包含:
            - item: 文献条目
            - attachment: 附件信息
            - path: 本地文件路径
        """
        items = self.get_collection_items(
            collection_name,
            include_subcollections=include_subcollections,
            pdf_only=True
        )
        
        pdf_files = []
        for item in items:
            for att in item.pdf_attachments:
                path = self._client.resolve_attachment_path(att)
                if path and path.exists():
                    pdf_files.append({
                        "item": item,
                        "attachment": att,
                        "path": path
                    })
        
        return pdf_files
    
    def search(self, query: SearchQuery) -> List[Item]:
        """
        高级搜索
        
        Args:
            query: 搜索查询参数
            
        Returns:
            匹配的条目列表
        """
        # 获取基础结果集
        if query.collection_name:
            items = self.get_collection_items(query.collection_name)
        else:
            items = self._client.get_all_items(limit=500)
        
        # 应用过滤器
        results = items
        
        if query.keywords:
            results = self._filter_by_keywords(results, query.keywords)
        
        if query.authors:
            results = self._filter_by_authors(results, query.authors)
        
        if query.tags:
            results = self._filter_by_tags(results, query.tags)
        
        if query.item_types:
            results = [
                item for item in results
                if item.item_type in query.item_types
            ]
        
        if query.has_pdf:
            results = [item for item in results if item.has_pdf]
        
        return results
    
    def _filter_by_keywords(
        self,
        items: List[Item],
        keywords: List[str]
    ) -> List[Item]:
        """按关键词过滤"""
        results = []
        for item in items:
            text = f"{item.title} {item.abstract or ''}"
            text_lower = text.lower()
            if all(kw.lower() in text_lower for kw in keywords):
                results.append(item)
        return results
    
    def _filter_by_authors(
        self,
        items: List[Item],
        authors: List[str]
    ) -> List[Item]:
        """按作者过滤"""
        results = []
        for item in items:
            authors_str = item.authors_str.lower()
            if any(author.lower() in authors_str for author in authors):
                results.append(item)
        return results
    
    def _filter_by_tags(
        self,
        items: List[Item],
        tags: List[str]
    ) -> List[Item]:
        """按标签过滤"""
        results = []
        tags_lower = [t.lower() for t in tags]
        for item in items:
            item_tags = [t.lower() for t in item.tags]
            if any(t in item_tags for t in tags_lower):
                results.append(item)
        return results
    
    def list_collection_names(self) -> List[str]:
        """列出所有集合名称"""
        collections = self.get_all_collections()
        return [c.name for c in collections]
    
    def get_collection_tree(self) -> Dict[str, any]:
        """
        获取集合树形结构
        
        Returns:
            树形结构的集合信息
        """
        collections = self.get_all_collections()
        
        # 构建树
        tree = {}
        key_to_col = {c.key: c for c in collections}
        
        def build_node(col: Collection) -> Dict:
            return {
                "key": col.key,
                "name": col.name,
                "num_items": col.num_items,
                "children": []
            }
        
        # 找出根节点
        roots = [c for c in collections if not c.parent_key]
        
        def add_children(parent_key: str, node: Dict):
            for col in collections:
                if col.parent_key == parent_key:
                    child_node = build_node(col)
                    add_children(col.key, child_node)
                    node["children"].append(child_node)
        
        result = []
        for root in roots:
            node = build_node(root)
            add_children(root.key, node)
            result.append(node)
        
        return {"collections": result}
