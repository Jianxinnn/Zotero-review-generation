"""
日志工具模块
"""

import logging
import sys
from typing import Optional

from rich.console import Console
from rich.logging import RichHandler

from config import get_settings


_console = Console()
_loggers: dict = {}


def setup_logging(level: Optional[str] = None) -> None:
    """
    设置全局日志配置
    
    Args:
        level: 日志级别，如果不指定则从配置读取
    """
    settings = get_settings()
    log_level = level or settings.log_level
    
    # 配置根日志
    logging.basicConfig(
        level=log_level,
        format="%(message)s",
        datefmt="[%X]",
        handlers=[
            RichHandler(
                console=_console,
                rich_tracebacks=True,
                markup=True
            )
        ]
    )
    
    # 降低第三方库日志级别
    for name in ["httpx", "httpcore", "openai", "chromadb"]:
        logging.getLogger(name).setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    """
    获取指定名称的 logger
    
    Args:
        name: logger 名称
        
    Returns:
        Logger 实例
    """
    if name not in _loggers:
        logger = logging.getLogger(name)
        _loggers[name] = logger
    return _loggers[name]


def print_info(message: str) -> None:
    """打印信息"""
    _console.print(f"[blue]ℹ[/blue] {message}")


def print_success(message: str) -> None:
    """打印成功信息"""
    _console.print(f"[green]✓[/green] {message}")


def print_warning(message: str) -> None:
    """打印警告"""
    _console.print(f"[yellow]⚠[/yellow] {message}")


def print_error(message: str) -> None:
    """打印错误"""
    _console.print(f"[red]✗[/red] {message}")
