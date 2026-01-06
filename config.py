"""
配置管理模块
支持从环境变量和 .env 文件加载配置
"""

from pathlib import Path
from typing import Optional

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class ZoteroSettings(BaseSettings):
    """Zotero 配置"""
    library_id: str = Field(default="", description="Zotero 用户 Library ID")
    library_type: str = Field(default="user", description="Library 类型: user 或 group")
    api_key: str = Field(default="", description="Zotero API Key")
    
    # 本地 Zotero 数据目录 (用于直接读取附件)
    data_dir: Path = Field(
        default=Path.home() / "Zotero",
        description="Zotero 本地数据目录"
    )
    
    model_config = SettingsConfigDict(
        env_prefix="ZOTERO_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


class AISettings(BaseSettings):
    """AI 模型配置"""
    provider: str = Field(default="openai", description="AI 提供商: openai, azure, ollama")
    api_key: str = Field(default="", description="API Key")
    api_base: Optional[str] = Field(default=None, description="自定义 API Base URL")
    model: str = Field(default="gpt-4o-mini", description="使用的模型名称")
    temperature: float = Field(default=0.7, description="生成温度")
    max_tokens: int = Field(default=64000, description="最大生成 token 数")
    
    model_config = SettingsConfigDict(
        env_prefix="AI_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


class IndexSettings(BaseSettings):
    """索引配置"""
    persist_dir: Path = Field(
        default=Path("./data/index"),
        description="索引持久化目录"
    )
    chunk_size: int = Field(default=1000, description="文本分块大小")
    chunk_overlap: int = Field(default=200, description="分块重叠大小")
    
    model_config = SettingsConfigDict(
        env_prefix="INDEX_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


class ChatSettings(BaseSettings):
    """对话配置"""
    max_full_docs: int = Field(
        default=20,
        description="全文对话时的最大文献数量"
    )
    max_abstract_docs: Optional[int] = Field(
        default=None,
        description="摘要对话时的最大文献数量，None 表示不限制"
    )
    
    @field_validator("max_abstract_docs", mode="before")
    @classmethod
    def empty_str_to_none(cls, v):
        if v == "" or v is None:
            return None
        return v
    
    model_config = SettingsConfigDict(
        env_prefix="CHAT_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


class AppSettings(BaseSettings):
    """应用全局配置"""
    debug: bool = Field(default=False, description="调试模式")
    log_level: str = Field(default="INFO", description="日志级别")
    
    zotero: ZoteroSettings = Field(default_factory=ZoteroSettings)
    ai: AISettings = Field(default_factory=AISettings)
    index: IndexSettings = Field(default_factory=IndexSettings)
    chat: ChatSettings = Field(default_factory=ChatSettings)
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


# 全局配置实例
settings = AppSettings()


def get_settings() -> AppSettings:
    """获取配置实例"""
    return settings
