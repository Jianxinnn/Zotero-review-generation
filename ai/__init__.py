"""
AI 模块
提供文献总结和深度研究功能
"""

from .prompts import PromptTemplates
from .summarizer import AISummarizer, SummaryResult, ResearchReport

__all__ = [
    "PromptTemplates",
    "AISummarizer",
    "SummaryResult",
    "ResearchReport"
]
