"""
Zotero API 客户端
提供与 Zotero 服务器的 API 交互
"""

import concurrent.futures
import sqlite3
from datetime import datetime
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
        # 优先使用本地 sqlite，失败或不可用时回退 API
        local_collections = self._get_collections_local()
        if local_collections is not None:
            return local_collections
        
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
        # 优先尝试本地 sqlite，失败/不可用时回退 API
        local_items = self._get_collection_items_local(collection_key)
        if local_items is not None:
            return local_items
        
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

    def _get_sqlite_conn(self) -> Optional[sqlite3.Connection]:
        """只读打开本地 zotero.sqlite，失败返回 None。"""
        db_path = self.data_dir / "zotero.sqlite"
        if not db_path.exists():
            return None
        try:
            conn = sqlite3.connect(
                f"file:{db_path}?mode=ro&immutable=1",
                uri=True,
                timeout=1
            )
            conn.row_factory = sqlite3.Row
            return conn
        except sqlite3.Error:
            return None

    def _search_items_local(self, query: str, limit: Optional[int], offset: int) -> Optional[List[Item]]:
        """
        尝试使用本地 zotero.sqlite 进行只读搜索。
        返回 None 表示本地不可用或查询失败，应回退到 API；返回列表表示本地查询成功。
        """
        conn = self._get_sqlite_conn()
        if conn is None:
            return None
        
        like_pattern = f"%{query}%"
        sql = """
        WITH target AS (
            SELECT items.itemID,
                   items.key,
                   itemTypes.typeName AS itemType,
                   title.value AS title,
                   abstract.value AS abstract,
                   date.value AS date,
                   items.dateAdded AS dateAdded,
                   items.dateModified AS dateModified,
                   publication.value AS publication,
                   doi.value AS doi,
                   url.value AS url
            FROM items
            JOIN itemTypes USING (itemTypeID)
            LEFT JOIN itemData titleData
                ON titleData.itemID = items.itemID
               AND titleData.fieldID = (SELECT fieldID FROM fields WHERE fieldName='title')
            LEFT JOIN itemDataValues title ON title.valueID = titleData.valueID
            LEFT JOIN itemData absData
                ON absData.itemID = items.itemID
               AND absData.fieldID = (SELECT fieldID FROM fields WHERE fieldName='abstractNote')
            LEFT JOIN itemDataValues abstract ON abstract.valueID = absData.valueID
            LEFT JOIN itemData dateData
                ON dateData.itemID = items.itemID
               AND dateData.fieldID = (SELECT fieldID FROM fields WHERE fieldName='date')
            LEFT JOIN itemDataValues date ON date.valueID = dateData.valueID
            LEFT JOIN itemData pubData
                ON pubData.itemID = items.itemID
               AND pubData.fieldID = (SELECT fieldID FROM fields WHERE fieldName='publicationTitle')
            LEFT JOIN itemDataValues publication ON publication.valueID = pubData.valueID
            LEFT JOIN itemData doiData
                ON doiData.itemID = items.itemID
               AND doiData.fieldID = (SELECT fieldID FROM fields WHERE fieldName='DOI')
            LEFT JOIN itemDataValues doi ON doi.valueID = doiData.valueID
            LEFT JOIN itemData urlData
                ON urlData.itemID = items.itemID
               AND urlData.fieldID = (SELECT fieldID FROM fields WHERE fieldName='url')
            LEFT JOIN itemDataValues url ON url.valueID = urlData.valueID
            LEFT JOIN deletedItems di ON di.itemID = items.itemID
            WHERE di.itemID IS NULL
              AND itemTypes.typeName != 'attachment'
        )
        SELECT * FROM target
        WHERE title LIKE ? OR abstract LIKE ?
        ORDER BY dateAdded DESC
        LIMIT ? OFFSET ?
        """
        try:
            rows = conn.execute(
                sql,
                (
                    like_pattern,
                    like_pattern,
                    limit if limit is not None else -1,
                    offset,
                ),
            ).fetchall()
        except sqlite3.Error:
            conn.close()
            return None
        
        item_ids = [r["itemID"] for r in rows]
        tags_map = self._get_tags_for_items_local(conn, item_ids)
        attachments_map = self._get_attachments_for_items_local(conn, item_ids)
        creators_map = self._get_creators_for_items_local(conn, item_ids)
        collections_map = self._get_collections_for_items_local(conn, item_ids)
        conn.close()
        
        # 如果某个映射获取失败，用空映射兜底，避免直接回退到 API
        tags_map = tags_map or {}
        attachments_map = attachments_map or {}
        creators_map = creators_map or {}
        collections_map = collections_map or {}
        
        items: List[Item] = []
        for row in rows:
            date_added = None
            date_modified = None
            if row["dateAdded"]:
                try:
                    date_added = datetime.fromisoformat(row["dateAdded"].replace("Z", "+00:00"))
                except Exception:
                    date_added = None
            if row["dateModified"]:
                try:
                    date_modified = datetime.fromisoformat(row["dateModified"].replace("Z", "+00:00"))
                except Exception:
                    date_modified = None
            items.append(Item(
                key=row["key"],
                item_type=row["itemType"] or "",
                title=row["title"] or "",
                creators=creators_map.get(row["itemID"], []),
                abstract=row["abstract"],
                date=row["date"],
                publication=row["publication"],
                doi=row["doi"],
                url=row["url"],
                tags=tags_map.get(row["itemID"], []),
                collections=collections_map.get(row["itemID"], []),
                attachments=attachments_map.get(row["itemID"], []),
                date_added=date_added,
                date_modified=date_modified,
                raw_data={"source": "local_sqlite"}
            ))
        
        # 相关性排序：标题权重更高，然后按 date_added 逆序
        keywords = [kw for kw in query.lower().split() if kw]
        
        def relevance_score(item: Item) -> int:
            title = (item.title or "").lower()
            abstract = (item.abstract or "").lower()
            score = 0
            for kw in keywords:
                score += title.count(kw) * 2
                score += abstract.count(kw)
            return score
        
        for item in items:
            score = relevance_score(item)
            item.raw_data["relevance_score"] = score
        
        def sort_key(item: Item):
            score = item.raw_data.get("relevance_score", 0)
            ts = item.date_added.timestamp() if item.date_added else float("-inf")
            return (score, ts)
        
        items.sort(key=sort_key, reverse=True)
        if limit is None:
            return items[offset:]
        return items[offset:offset + limit]

    def search_items(self, query: str, limit: Optional[int] = None, offset: int = 0) -> List[Item]:
        """
        搜索条目
        
        Args:
            query: 搜索关键词
            limit: 最大返回数量
            
        Returns:
            条目列表
        """
        local_items = self._search_items_local(query, limit, offset)
        if local_items is not None:
            return local_items
        
        # 使用 items(q=query, limit=limit) 进行搜索
        # itemType="-attachment" 排除附件，只搜索父条目
        # qmode="everything" 确保搜索范围最广
        api_limit = limit if limit is not None else 100  # Zotero API 默认限制，最大 100
        raw_items = self.client.items(
            q=query, 
            qmode="everything", 
            limit=api_limit, 
            start=offset,
            itemType="-attachment"
        )
        items = [self._parse_item(i) for i in raw_items]
        
        # 优化：搜索时不并发获取附件，以提高响应速度
        # 附件信息将在需要时（如加载 PDF）按需获取
        
        return items
    
    def _get_collections_local(self) -> Optional[List[Collection]]:
        """
        使用本地 sqlite 获取集合列表。
        返回 None 表示本地不可用/查询失败；返回列表表示本地结果（可能为空）。
        """
        conn = self._get_sqlite_conn()
        if conn is None:
            return None
        
        try:
            rows = conn.execute("""
            SELECT c.collectionID, c.key, c.collectionName AS name, c.parentCollectionID
            FROM collections c
            LEFT JOIN deletedCollections dc ON dc.collectionID = c.collectionID
            WHERE dc.collectionID IS NULL
            """).fetchall()
        except sqlite3.Error:
            conn.close()
            return None
        
        collection_ids = [r["collectionID"] for r in rows]
        id_to_key = {r["collectionID"]: r["key"] for r in rows}
        
        num_items_map: Dict[int, int] = {}
        num_collections_map: Dict[int, int] = {}
        
        def chunked(seq, size=500):
            for i in range(0, len(seq), size):
                yield seq[i:i+size]
        
        if collection_ids:
            try:
                for chunk in chunked(collection_ids):
                    placeholders = ",".join("?" for _ in chunk)
                    sql_items = f"""
                    SELECT ci.collectionID, COUNT(*) AS cnt
                    FROM collectionItems ci
                    JOIN items i ON i.itemID = ci.itemID
                    JOIN itemTypes it ON it.itemTypeID = i.itemTypeID
                    LEFT JOIN deletedItems di ON di.itemID = i.itemID
                    WHERE di.itemID IS NULL
                      AND it.typeName != 'attachment'
                      AND ci.collectionID IN ({placeholders})
                    GROUP BY ci.collectionID
                    """
                    for row in conn.execute(sql_items, chunk):
                        num_items_map[row["collectionID"]] = row["cnt"]
                
                for chunk in chunked(collection_ids):
                    placeholders = ",".join("?" for _ in chunk)
                    sql_children = f"""
                    SELECT parentCollectionID AS pid, COUNT(*) AS cnt
                    FROM collections c
                    LEFT JOIN deletedCollections dc ON dc.collectionID = c.collectionID
                    WHERE dc.collectionID IS NULL
                      AND parentCollectionID IN ({placeholders})
                    GROUP BY parentCollectionID
                    """
                    for row in conn.execute(sql_children, chunk):
                        num_collections_map[row["pid"]] = row["cnt"]
            except sqlite3.Error:
                conn.close()
                return None
        
        conn.close()
        
        collections: List[Collection] = []
        for r in rows:
            parent_key = id_to_key.get(r["parentCollectionID"]) if r["parentCollectionID"] else None
            collections.append(Collection(
                key=r["key"],
                name=r["name"],
                parent_key=parent_key,
                num_items=num_items_map.get(r["collectionID"], 0),
                num_collections=num_collections_map.get(r["collectionID"], 0)
            ))
        return collections
    
    def _get_tags_for_items_local(
        self,
        conn: sqlite3.Connection,
        item_ids: List[int]
    ) -> Optional[Dict[int, List[str]]]:
        """批量获取条目的标签映射 itemID -> [tag]。异常时返回 None。"""
        tags_map: Dict[int, List[str]] = {}
        
        if not item_ids:
            return tags_map
        
        def chunked(seq, size=500):
            for i in range(0, len(seq), size):
                yield seq[i:i+size]
        
        for chunk in chunked(item_ids):
            placeholders = ",".join("?" for _ in chunk)
            sql = f"""
            SELECT it.itemID, t.name
            FROM itemTags it
            JOIN tags t ON t.tagID = it.tagID
            WHERE it.itemID IN ({placeholders})
            """
            try:
                for row in conn.execute(sql, chunk):
                    tags_map.setdefault(row["itemID"], []).append(row["name"])
            except sqlite3.Error:
                return None
        
        return tags_map
    
    def _get_creators_for_items_local(
        self,
        conn: sqlite3.Connection,
        item_ids: List[int]
    ) -> Optional[Dict[int, List[Dict[str, str]]]]:
        """批量获取作者/创作者列表，按 orderIndex 排序。"""
        creators_map: Dict[int, List[Dict[str, str]]] = {}
        if not item_ids:
            return creators_map
        
        def chunked(seq, size=500):
            for i in range(0, len(seq), size):
                yield seq[i:i+size]
        
        for chunk in chunked(item_ids):
            placeholders = ",".join("?" for _ in chunk)
            # Zotero's creators table has firstName, lastName, fieldMode
            # fieldMode=1 means single-field mode (name stored in lastName)
            # We generate a 'name' field for compatibility
            sql = f"""
            SELECT ic.itemID,
                   ct.creatorType,
                   c.firstName,
                   c.lastName,
                   c.fieldMode,
                   ic.orderIndex
            FROM itemCreators ic
            JOIN creators c ON c.creatorID = ic.creatorID
            JOIN creatorTypes ct ON ct.creatorTypeID = ic.creatorTypeID
            WHERE ic.itemID IN ({placeholders})
            ORDER BY ic.itemID, ic.orderIndex
            """
            try:
                for row in conn.execute(sql, chunk):
                    # fieldMode=1 means single-field (use lastName as full name)
                    # fieldMode=0 means two-field (firstName + lastName)
                    field_mode = row["fieldMode"] if row["fieldMode"] is not None else 0
                    if field_mode == 1:
                        # Single-field mode: lastName contains the full name
                        name = row["lastName"] or ""
                    else:
                        # Two-field mode: no single name, authors_str will combine firstName + lastName
                        name = ""
                    
                    creators_map.setdefault(row["itemID"], []).append({
                        "creatorType": row["creatorType"],
                        "firstName": row["firstName"] or "",
                        "lastName": row["lastName"] or "",
                        "name": name
                    })
            except sqlite3.Error as e:
                print(f"Error fetching creators: {e}")
                return None
        
        return creators_map
    
    def _get_collections_for_items_local(
        self,
        conn: sqlite3.Connection,
        item_ids: List[int]
    ) -> Optional[Dict[int, List[str]]]:
        """批量获取条目所属集合 key 列表。"""
        col_map: Dict[int, List[str]] = {}
        if not item_ids:
            return col_map
        
        def chunked(seq, size=500):
            for i in range(0, len(seq), size):
                yield seq[i:i+size]
        
        for chunk in chunked(item_ids):
            placeholders = ",".join("?" for _ in chunk)
            sql = f"""
            SELECT ci.itemID, c.key
            FROM collectionItems ci
            JOIN collections c ON c.collectionID = ci.collectionID
            LEFT JOIN deletedCollections dc ON dc.collectionID = c.collectionID
            WHERE dc.collectionID IS NULL
              AND ci.itemID IN ({placeholders})
            """
            try:
                for row in conn.execute(sql, chunk):
                    col_map.setdefault(row["itemID"], []).append(row["key"])
            except sqlite3.Error:
                return None
        
        return col_map
    
    def _get_attachments_for_items_local(
        self,
        conn: sqlite3.Connection,
        parent_item_ids: List[int]
    ) -> Optional[Dict[int, List[Attachment]]]:
        """批量获取父条目的附件列表映射。异常时返回 None。"""
        attachments_map: Dict[int, List[Attachment]] = {}
        
        if not parent_item_ids:
            return attachments_map
        
        def chunked(seq, size=300):
            for i in range(0, len(seq), size):
                yield seq[i:i+size]
        
        for chunk in chunked(parent_item_ids):
            placeholders = ",".join("?" for _ in chunk)
            sql = f"""
            SELECT ia.parentItemID,
                   i.key AS attachmentKey,
                   ia.linkMode,
                   ia.contentType,
                   ia.path,
                   att_title.value AS title
            FROM itemAttachments ia
            JOIN items i ON i.itemID = ia.itemID
            JOIN itemTypes it ON it.itemTypeID = i.itemTypeID
            LEFT JOIN itemData attTitleData
                ON attTitleData.itemID = i.itemID
               AND attTitleData.fieldID = (SELECT fieldID FROM fields WHERE fieldName='title')
            LEFT JOIN itemDataValues att_title ON att_title.valueID = attTitleData.valueID
            WHERE ia.parentItemID IN ({placeholders})
              AND it.typeName = 'attachment'
            """
            try:
                for row in conn.execute(sql, chunk):
                    path_str = row["path"] or ""
                    filename = None
                    local_path = None
                    if path_str:
                        path_body = path_str.split(":", 1)[1] if ":" in path_str else path_str
                        filename = Path(path_body).name if path_body else None
                        # 为提速：搜索阶段先不做文件存在检查，后续按需 resolve_attachment_path
                    
                    att = Attachment(
                        key=row["attachmentKey"],
                        title=row["title"] or filename or "",
                        filename=filename,
                        content_type=row["contentType"],
                        path=local_path,
                        link_mode=str(row["linkMode"]) if row["linkMode"] is not None else ""
                    )
                    attachments_map.setdefault(row["parentItemID"], []).append(att)
            except sqlite3.Error:
                return None
        
        return attachments_map
    
    def _get_collection_items_local(self, collection_key: str) -> Optional[List[Item]]:
        """
        使用本地 sqlite 获取某集合中的条目（不含附件类型）。
        返回 None 表示本地不可用或查询失败；返回列表表示本地结果（可为空）。
        """
        conn = self._get_sqlite_conn()
        if conn is None:
            return None
        
        try:
            row = conn.execute("""
            SELECT c.collectionID
            FROM collections c
            LEFT JOIN deletedCollections dc ON dc.collectionID = c.collectionID
            WHERE c.key = ?
              AND dc.collectionID IS NULL
            """, (collection_key,)).fetchone()
        except sqlite3.Error:
            conn.close()
            return None
        
        if not row:
            conn.close()
            return None
        
        collection_id = row["collectionID"]
        
        sql = """
        WITH target AS (
            SELECT i.itemID,
                   i.key,
                   it.typeName AS itemType,
                   title.value AS title,
                   abstract.value AS abstract,
                   date.value AS date,
                   i.dateAdded AS dateAdded,
                   i.dateModified AS dateModified,
                   publication.value AS publication,
                   doi.value AS doi,
                   url.value AS url
            FROM collectionItems ci
            JOIN items i ON i.itemID = ci.itemID
            JOIN itemTypes it ON it.itemTypeID = i.itemTypeID
            LEFT JOIN itemData titleData
                ON titleData.itemID = i.itemID
               AND titleData.fieldID = (SELECT fieldID FROM fields WHERE fieldName='title')
            LEFT JOIN itemDataValues title ON title.valueID = titleData.valueID
            LEFT JOIN itemData absData
                ON absData.itemID = i.itemID
               AND absData.fieldID = (SELECT fieldID FROM fields WHERE fieldName='abstractNote')
            LEFT JOIN itemDataValues abstract ON abstract.valueID = absData.valueID
            LEFT JOIN itemData dateData
                ON dateData.itemID = i.itemID
               AND dateData.fieldID = (SELECT fieldID FROM fields WHERE fieldName='date')
            LEFT JOIN itemDataValues date ON date.valueID = dateData.valueID
            LEFT JOIN itemData pubData
                ON pubData.itemID = i.itemID
               AND pubData.fieldID = (SELECT fieldID FROM fields WHERE fieldName='publicationTitle')
            LEFT JOIN itemDataValues publication ON publication.valueID = pubData.valueID
            LEFT JOIN itemData doiData
                ON doiData.itemID = i.itemID
               AND doiData.fieldID = (SELECT fieldID FROM fields WHERE fieldName='DOI')
            LEFT JOIN itemDataValues doi ON doi.valueID = doiData.valueID
            LEFT JOIN itemData urlData
                ON urlData.itemID = i.itemID
               AND urlData.fieldID = (SELECT fieldID FROM fields WHERE fieldName='url')
            LEFT JOIN itemDataValues url ON url.valueID = urlData.valueID
            LEFT JOIN deletedItems di ON di.itemID = i.itemID
            WHERE di.itemID IS NULL
              AND it.typeName != 'attachment'
              AND ci.collectionID = ?
        )
        SELECT * FROM target
        """
        try:
            rows = conn.execute(sql, (collection_id,)).fetchall()
        except sqlite3.Error:
            conn.close()
            return None
        
        item_ids = [r["itemID"] for r in rows]
        tags_map = self._get_tags_for_items_local(conn, item_ids)
        attachments_map = self._get_attachments_for_items_local(conn, item_ids)
        creators_map = self._get_creators_for_items_local(conn, item_ids)
        collections_map = self._get_collections_for_items_local(conn, item_ids)
        conn.close()
        
        if any(m is None for m in (tags_map, attachments_map, creators_map, collections_map)):
            return None
        
        items: List[Item] = []
        for r in rows:
            date_added = None
            date_modified = None
            if r["dateAdded"]:
                try:
                    date_added = datetime.fromisoformat(r["dateAdded"].replace("Z", "+00:00"))
                except Exception:
                    date_added = None
            if r["dateModified"]:
                try:
                    date_modified = datetime.fromisoformat(r["dateModified"].replace("Z", "+00:00"))
                except Exception:
                    date_modified = None
            col_keys = collections_map.get(r["itemID"], [])
            if collection_key not in col_keys:
                col_keys = list(col_keys) + [collection_key]
            items.append(Item(
                key=r["key"],
                item_type=r["itemType"] or "",
                title=r["title"] or "",
                creators=creators_map.get(r["itemID"], []),
                abstract=r["abstract"],
                date=r["date"],
                publication=r["publication"],
                doi=r["doi"],
                url=r["url"],
                tags=tags_map.get(r["itemID"], []),
                collections=col_keys,
                attachments=attachments_map.get(r["itemID"], []),
                date_added=date_added,
                date_modified=date_modified,
                raw_data={"source": "local_sqlite"}
            ))
        
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
