"""
AI 总结器
提供文献总结和深度研究功能
"""

from typing import List, Optional, Dict, Any, Generator
from datetime import datetime

from pydantic import BaseModel, Field

from config import get_settings
from utils import get_logger
from indexer import DocumentInfo
from .prompts import PromptTemplates

logger = get_logger(__name__)


class SummaryResult(BaseModel):
    """总结结果模型"""
    doc_id: str = Field(..., description="文档 ID")
    title: str = Field(..., description="文档标题")
    summary: str = Field(..., description="总结内容")
    summary_type: str = Field(default="full", description="总结类型")
    model: str = Field(default="", description="使用的模型")
    tokens_used: int = Field(default=0, description="消耗的 token 数")
    created_at: datetime = Field(default_factory=datetime.now, description="创建时间")


class ResearchReport(BaseModel):
    """深度研究报告模型"""
    question: str = Field(..., description="研究问题")
    report: str = Field(..., description="研究报告")
    sources: List[str] = Field(default_factory=list, description="引用的文献")
    model: str = Field(default="", description="使用的模型")
    tokens_used: int = Field(default=0, description="消耗的 token 数")
    created_at: datetime = Field(default_factory=datetime.now, description="创建时间")


class AISummarizer:
    """AI 总结器"""
    
    def __init__(
        self,
        provider: Optional[str] = None,
        api_key: Optional[str] = None,
        api_base: Optional[str] = None,
        model: Optional[str] = None
    ):
        """
        初始化 AI 总结器
        
        Args:
            provider: AI 提供商
            api_key: API Key
            api_base: API Base URL
            model: 模型名称
        """
        settings = get_settings()
        
        self.provider = provider or settings.ai.provider
        self.api_key = api_key or settings.ai.api_key
        self.api_base = api_base or settings.ai.api_base
        self.model = model or settings.ai.model
        self.temperature = settings.ai.temperature
        self.max_tokens = settings.ai.max_tokens
        
        self._client = None
    
    def _get_client(self):
        """获取 AI 客户端"""
        if self._client is not None:
            return self._client
        
        if self.provider == "openai":
            from openai import OpenAI
            
            kwargs = {"api_key": self.api_key}
            if self.api_base:
                kwargs["base_url"] = self.api_base
            
            self._client = OpenAI(**kwargs)
        else:
            raise ValueError(f"不支持的 AI 提供商: {self.provider}")
        
        return self._client
    
    def _chat_completion(
        self,
        messages: List[Dict[str, str]],
        stream: bool = False
    ) -> str | Generator:
        """
        调用 AI 完成对话
        
        Args:
            messages: 消息列表
            stream: 是否流式输出
            
        Returns:
            生成的文本或生成器
        """
        client = self._get_client()
        
        try:
            response = client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=self.temperature,
                max_tokens=self.max_tokens,
                stream=stream
            )
            
            if stream:
                def generate():
                    for chunk in response:
                        if chunk.choices[0].delta.content:
                            yield chunk.choices[0].delta.content
                return generate()
            else:
                return response.choices[0].message.content
                
        except Exception as e:
            logger.error(f"AI 调用失败: {e}")
            raise
    
    def summarize_document(
        self,
        document: DocumentInfo,
        summary_type: str = "full",
        stream: bool = False
    ) -> SummaryResult | Generator:
        """
        总结单个文档
        
        Args:
            document: 文档信息
            summary_type: 总结类型 (full/quick/key_points)
            stream: 是否流式输出
            
        Returns:
            总结结果或生成器
        """
        if summary_type == "quick":
            prompt = PromptTemplates.get_quick_summary_prompt(
                title=document.title,
                authors=document.authors,
                abstract=document.abstract,
                content_snippet=document.pdf_content[:2000] if document.pdf_content else ""
            )
        elif summary_type == "key_points":
            prompt = PromptTemplates.KEY_POINTS.format(
                title=document.title,
                content=document.pdf_content[:10000] if document.pdf_content else document.abstract or ""
            )
        else:  # full
            prompt = PromptTemplates.get_single_summary_prompt(
                title=document.title,
                authors=document.authors,
                date=document.date,
                publication=document.publication,
                abstract=document.abstract,
                content=document.pdf_content or ""
            )
        
        messages = [
            {"role": "system", "content": "你是一位专业的学术研究助手，擅长分析和总结学术论文。"},
            {"role": "user", "content": prompt}
        ]
        
        if stream:
            return self._chat_completion(messages, stream=True)
        else:
            summary = self._chat_completion(messages, stream=False)
            return SummaryResult(
                doc_id=document.id,
                title=document.title,
                summary=summary,
                summary_type=summary_type,
                model=self.model
            )
    
    def summarize_multiple(
        self,
        documents: List[DocumentInfo],
        stream: bool = False
    ) -> SummaryResult | Generator:
        """
        综合总结多个文档
        
        Args:
            documents: 文档列表
            stream: 是否流式输出
            
        Returns:
            综合总结结果
        """
        papers = []
        for doc in documents:
            papers.append({
                "title": doc.title,
                "authors": doc.authors,
                "abstract": doc.abstract,
                "content": doc.pdf_content[:5000] if doc.pdf_content else ""
            })
        
        prompt = PromptTemplates.get_multi_paper_prompt(papers)
        
        messages = [
            {"role": "system", "content": "你是一位专业的学术研究助手，擅长综合分析多篇学术论文。"},
            {"role": "user", "content": prompt}
        ]
        
        if stream:
            return self._chat_completion(messages, stream=True)
        else:
            summary = self._chat_completion(messages, stream=False)
            return SummaryResult(
                doc_id=",".join(d.id for d in documents),
                title=f"综合分析: {len(documents)} 篇文献",
                summary=summary,
                summary_type="synthesis",
                model=self.model
            )
    
    def deep_research(
        self,
        question: str,
        documents: List[DocumentInfo],
        stream: bool = False
    ) -> ResearchReport | Generator:
        """
        深度研究
        
        Args:
            question: 研究问题
            documents: 相关文档列表
            stream: 是否流式输出
            
        Returns:
            研究报告
        """
        # 构建文献内容
        literature_parts = []
        for i, doc in enumerate(documents, 1):
            content = doc.pdf_content[:8000] if doc.pdf_content else doc.abstract or ""
            literature_parts.append(f"""
## 文献 {i}: {doc.title}
- **作者**: {doc.authors}
- **发表日期**: {doc.date or '未知'}
- **内容**:
{content}
""")
        
        literature_content = "\n---\n".join(literature_parts)
        
        prompt = PromptTemplates.get_deep_research_prompt(
            research_question=question,
            literature_content=literature_content
        )
        
        messages = [
            {"role": "system", "content": "你是一位资深的学术研究专家，擅长进行深度文献研究、知识综合和批判性分析。"},
            {"role": "user", "content": prompt}
        ]
        
        if stream:
            return self._chat_completion(messages, stream=True)
        else:
            report = self._chat_completion(messages, stream=False)
            return ResearchReport(
                question=question,
                report=report,
                sources=[d.title for d in documents],
                model=self.model
            )
    
    def generate_research_questions(
        self,
        documents: List[DocumentInfo]
    ) -> List[str]:
        """
        基于文献生成研究问题
        
        Args:
            documents: 文档列表
            
        Returns:
            研究问题列表
        """
        content_parts = []
        for doc in documents[:5]:  # 限制数量
            content = doc.pdf_content[:3000] if doc.pdf_content else doc.abstract or ""
            content_parts.append(f"**{doc.title}**\n{content}")
        
        prompt = PromptTemplates.RESEARCH_QUESTIONS.format(
            content="\n\n---\n\n".join(content_parts)
        )
        
        messages = [
            {"role": "system", "content": "你是一位学术研究顾问，擅长发现研究问题和研究方向。"},
            {"role": "user", "content": prompt}
        ]
        
        response = self._chat_completion(messages, stream=False)
        
        # 解析问题列表
        questions = []
        for line in response.split("\n"):
            line = line.strip()
            if line and (line[0].isdigit() or line.startswith("-") or line.startswith("•")):
                # 移除序号
                question = line.lstrip("0123456789.-•) ").strip()
                if question:
                    questions.append(question)
        
        return questions[:5]  # 最多返回5个
    
    def chat(
        self,
        message: str,
        context: Optional[List[DocumentInfo]] = None,
        history: Optional[List[Dict[str, str]]] = None,
        stream: bool = False
    ) -> str | Generator:
        """
        对话式交互
        
        Args:
            message: 用户消息
            context: 上下文文档
            history: 对话历史
            stream: 是否流式输出
            
        Returns:
            AI 回复
        """
        system_prompt = "你是一位专业的学术研究助手，可以帮助用户分析和理解学术文献。"
        
        if context:
            context_text = "\n\n".join([
                f"**{doc.title}** by {doc.authors}\n{doc.abstract or ''}"
                for doc in context[:5]
            ])
            system_prompt += f"\n\n以下是相关文献供参考:\n{context_text}"
        
        messages = [{"role": "system", "content": system_prompt}]
        
        if history:
            messages.extend(history[-10:])  # 保留最近10轮对话
        
        messages.append({"role": "user", "content": message})
        
        return self._chat_completion(messages, stream=stream)
