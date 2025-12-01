"""
Zotero 模块
提供与 Zotero API 的交互功能
"""

from .client import ZoteroClient
from .models import Collection, Item, Attachment
from .collection import CollectionManager

__all__ = [
    "ZoteroClient",
    "Collection",
    "Item", 
    "Attachment",
    "CollectionManager"
]
