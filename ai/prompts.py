"""
Prompt 模板管理
"""

from typing import Dict, List, Optional


class PromptTemplates:
    """Prompt 模板集合"""
    
    # 单篇文献总结
    SINGLE_PAPER_SUMMARY = """你是一位专业的学术研究助手。请对以下学术论文进行全面而深入的总结。

## 论文信息
- **标题**: {title}
- **作者**: {authors}
- **发表日期**: {date}
- **期刊/出版物**: {publication}

## 摘要
{abstract}

## 全文内容
{content}

---

请按照以下结构进行总结：

### 1. 研究背景与动机
- 研究的背景是什么？
- 解决什么问题？
- 为什么这个问题重要？

### 2. 核心方法
- 使用了什么方法/技术？
- 方法的创新点是什么？

### 3. 主要发现与结果
- 主要的实验结果是什么？
- 关键的数据或指标

### 4. 结论与贡献
- 论文的主要贡献是什么？
- 对领域的影响

### 5. 局限性与未来方向
- 研究的局限性
- 可能的未来研究方向

### 6. 关键词和主题
- 列出3-5个关键词
- 论文涉及的主要主题领域

请用清晰、专业的学术语言进行总结，控制在800-1200字左右。"""

    # 多篇文献综合分析
    MULTI_PAPER_SYNTHESIS = """你是一位专业的学术研究助手。请对以下多篇相关学术论文进行综合分析和对比。

## 论文列表

{papers_list}

---

请按照以下结构进行综合分析：

### 1. 主题概述
- 这些论文共同关注的研究领域/问题是什么？
- 研究的整体背景

### 2. 方法对比
- 各论文使用的方法有何异同？
- 方法论上的演进或创新

### 3. 发现与结论对比
- 各论文的主要发现
- 结论之间是否有一致性或矛盾？

### 4. 研究趋势
- 从这些论文中可以看出什么研究趋势？
- 该领域的发展方向

### 5. 知识缺口与机会
- 现有研究的不足
- 潜在的研究机会

### 6. 综合结论
- 对这组文献的整体评价
- 对后续研究的建议

请提供深入、有洞察力的分析，控制在1500-2000字。"""

    # Deep Research 深度研究
    DEEP_RESEARCH = """你是一位资深的学术研究专家，擅长进行深度文献研究和知识综合。

## 研究问题
{research_question}

## 相关文献资料

{literature_content}

---

请进行深度研究分析，按以下结构输出研究报告：

# 深度研究报告

## 执行摘要
- 研究问题的简要回答
- 主要发现概述

## 1. 研究背景
- 问题的重要性
- 当前研究现状概述

## 2. 文献分析

### 2.1 理论框架
- 主要理论和概念
- 理论的演进

### 2.2 方法论综述
- 常用研究方法
- 方法的优缺点

### 2.3 实证发现
- 关键实证结果
- 证据的一致性分析

## 3. 批判性分析
- 现有研究的优势
- 研究的局限和不足
- 存在的争议或分歧

## 4. 知识图谱
- 核心概念之间的关系
- 研究主题的分类

## 5. 研究趋势与展望
- 新兴研究方向
- 未来研究建议
- 潜在的突破领域

## 6. 结论
- 关键洞察总结
- 实践建议

## 参考文献摘要
- 引用的关键文献列表

请提供全面、深入、有学术价值的研究报告，字数在2000-3000字之间。"""

    # 快速摘要
    QUICK_SUMMARY = """请用2-3句话简洁地总结以下论文的核心内容：

标题: {title}
作者: {authors}
摘要: {abstract}

内容片段: {content_snippet}

请直接给出简洁的总结，不需要标题或格式。"""

    # 关键点提取
    KEY_POINTS = """请从以下论文中提取5-7个关键要点：

标题: {title}
内容: {content}

请以简洁的要点形式输出，每个要点用一句话概括。"""

    # 研究问题生成
    RESEARCH_QUESTIONS = """基于以下文献内容，生成3-5个值得进一步研究的问题：

{content}

请列出具有研究价值的问题，每个问题应该：
1. 具体且可操作
2. 与现有文献相关但尚未充分解答
3. 具有学术或实践价值"""

    @classmethod
    def get_single_summary_prompt(
        cls,
        title: str,
        authors: str,
        date: Optional[str],
        publication: Optional[str],
        abstract: Optional[str],
        content: str
    ) -> str:
        """生成单篇论文总结 prompt"""
        return cls.SINGLE_PAPER_SUMMARY.format(
            title=title,
            authors=authors,
            date=date or "未知",
            publication=publication or "未知",
            abstract=abstract or "无摘要",
            content=content[:15000]  # 限制长度
        )
    
    @classmethod
    def get_multi_paper_prompt(cls, papers: List[Dict]) -> str:
        """生成多篇论文综合分析 prompt"""
        papers_text = []
        for i, paper in enumerate(papers, 1):
            paper_text = f"""
### 论文 {i}: {paper.get('title', '未知标题')}
- **作者**: {paper.get('authors', '未知')}
- **摘要**: {paper.get('abstract', '无摘要')}
- **关键内容**: {paper.get('content', '')[:3000]}
"""
            papers_text.append(paper_text)
        
        return cls.MULTI_PAPER_SYNTHESIS.format(
            papers_list="\n".join(papers_text)
        )
    
    @classmethod
    def get_deep_research_prompt(
        cls,
        research_question: str,
        literature_content: str
    ) -> str:
        """生成深度研究 prompt"""
        return cls.DEEP_RESEARCH.format(
            research_question=research_question,
            literature_content=literature_content[:20000]
        )
    
    @classmethod
    def get_quick_summary_prompt(
        cls,
        title: str,
        authors: str,
        abstract: Optional[str],
        content_snippet: str
    ) -> str:
        """生成快速摘要 prompt"""
        return cls.QUICK_SUMMARY.format(
            title=title,
            authors=authors,
            abstract=abstract or "无摘要",
            content_snippet=content_snippet[:2000]
        )
