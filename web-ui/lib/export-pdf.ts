/**
 * PDF 导出工具
 * 支持中文内容和 Markdown 渲染
 */

import { marked } from 'marked'

interface ExportPdfOptions {
  title: string
  content: string
  /** 是否为 Markdown 内容，默认 true */
  isMarkdown?: boolean
}

/**
 * 将 Markdown 内容转换为 HTML
 */
function markdownToHtml(markdown: string): string {
  // 配置 marked
  marked.setOptions({
    breaks: true,
    gfm: true,
  })
  
  return marked.parse(markdown) as string
}

/**
 * 转义 HTML 特殊字符
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

/**
 * 生成 PDF 导出的 HTML 模板
 */
function generatePdfHtml(options: ExportPdfOptions): string {
  const { title, content, isMarkdown = true } = options
  
  const htmlContent = isMarkdown ? markdownToHtml(content) : `<pre>${escapeHtml(content)}</pre>`
  
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style>
    /* 基础样式 - 支持中文字体 */
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    html {
      font-size: 14px;
    }
    
    body {
      font-family: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "WenQuanYi Micro Hei", 
                   -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      line-height: 1.8;
      color: #1a1a1a;
      padding: 40px 60px;
      max-width: 800px;
      margin: 0 auto;
      background: #fff;
    }
    
    /* 标题样式 */
    .document-title {
      font-size: 1.75rem;
      font-weight: 700;
      color: #111;
      margin-bottom: 1.5rem;
      padding-bottom: 1rem;
      border-bottom: 2px solid #e5e5e5;
      line-height: 1.4;
    }
    
    /* Markdown 内容样式 */
    .content {
      font-size: 1rem;
    }
    
    .content h1 {
      font-size: 1.5rem;
      font-weight: 700;
      margin: 2rem 0 1rem;
      color: #111;
      border-bottom: 1px solid #eee;
      padding-bottom: 0.5rem;
    }
    
    .content h2 {
      font-size: 1.25rem;
      font-weight: 600;
      margin: 1.75rem 0 0.75rem;
      color: #222;
    }
    
    .content h3 {
      font-size: 1.1rem;
      font-weight: 600;
      margin: 1.5rem 0 0.5rem;
      color: #333;
    }
    
    .content h4, .content h5, .content h6 {
      font-size: 1rem;
      font-weight: 600;
      margin: 1.25rem 0 0.5rem;
      color: #444;
    }
    
    .content p {
      margin: 0.75rem 0;
      text-align: justify;
    }
    
    .content ul, .content ol {
      margin: 0.75rem 0;
      padding-left: 1.5rem;
    }
    
    .content li {
      margin: 0.35rem 0;
    }
    
    .content li > ul, .content li > ol {
      margin: 0.25rem 0;
    }
    
    .content blockquote {
      margin: 1rem 0;
      padding: 0.75rem 1rem;
      border-left: 4px solid #ddd;
      background: #f9f9f9;
      color: #555;
    }
    
    .content blockquote p {
      margin: 0;
    }
    
    .content code {
      font-family: "SF Mono", "Fira Code", "Consolas", "Monaco", monospace;
      font-size: 0.9em;
      background: #f4f4f4;
      padding: 0.15rem 0.4rem;
      border-radius: 3px;
      color: #c7254e;
    }
    
    .content pre {
      margin: 1rem 0;
      padding: 1rem;
      background: #f8f8f8;
      border-radius: 6px;
      overflow-x: auto;
      border: 1px solid #e5e5e5;
    }
    
    .content pre code {
      background: none;
      padding: 0;
      color: inherit;
      font-size: 0.85rem;
      line-height: 1.6;
    }
    
    .content table {
      width: 100%;
      border-collapse: collapse;
      margin: 1rem 0;
      font-size: 0.9rem;
    }
    
    .content th, .content td {
      border: 1px solid #ddd;
      padding: 0.5rem 0.75rem;
      text-align: left;
    }
    
    .content th {
      background: #f5f5f5;
      font-weight: 600;
    }
    
    .content tr:nth-child(even) {
      background: #fafafa;
    }
    
    .content a {
      color: #0066cc;
      text-decoration: none;
    }
    
    .content a:hover {
      text-decoration: underline;
    }
    
    .content hr {
      margin: 1.5rem 0;
      border: none;
      border-top: 1px solid #e5e5e5;
    }
    
    .content img {
      max-width: 100%;
      height: auto;
    }
    
    .content strong {
      font-weight: 600;
      color: #111;
    }
    
    .content em {
      font-style: italic;
    }
    
    /* 打印样式优化 */
    @media print {
      body {
        padding: 20px 40px;
        font-size: 12px;
      }
      
      .document-title {
        font-size: 1.5rem;
      }
      
      .content h1 {
        font-size: 1.25rem;
      }
      
      .content h2 {
        font-size: 1.1rem;
      }
      
      .content h3 {
        font-size: 1rem;
      }
      
      .content pre {
        white-space: pre-wrap;
        word-wrap: break-word;
      }
      
      /* 避免在标题后分页 */
      h1, h2, h3, h4, h5, h6 {
        page-break-after: avoid;
      }
      
      /* 避免在段落中间分页 */
      p, li, blockquote {
        orphans: 3;
        widows: 3;
      }
      
      /* 避免在代码块中间分页 */
      pre, table {
        page-break-inside: avoid;
      }
    }
    
    /* 页脚 */
    .footer {
      margin-top: 3rem;
      padding-top: 1rem;
      border-top: 1px solid #e5e5e5;
      font-size: 0.75rem;
      color: #999;
      text-align: center;
    }
  </style>
</head>
<body>
  <h1 class="document-title">${escapeHtml(title)}</h1>
  <div class="content">
    ${htmlContent}
  </div>
  <div class="footer">
    由 Zotero Chat 生成 · ${new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })}
  </div>
</body>
</html>`
}

/**
 * 导出为 PDF（通过浏览器打印功能）
 * @returns 是否成功打开打印窗口
 */
export function exportToPdf(options: ExportPdfOptions): { success: boolean; error?: string } {
  try {
    const htmlContent = generatePdfHtml(options)
    
    // 方法1: 使用 iframe 打印（更可靠，不会被拦截）
    const iframe = document.createElement('iframe')
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = 'none'
    document.body.appendChild(iframe)
    
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
    if (!iframeDoc) {
      document.body.removeChild(iframe)
      return { 
        success: false, 
        error: "无法创建打印文档" 
      }
    }
    
    iframeDoc.open()
    iframeDoc.write(htmlContent)
    iframeDoc.close()
    
    // 等待内容加载完成后打印
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus()
        iframe.contentWindow?.print()
      } catch (e) {
        console.error('打印失败:', e)
      }
      
      // 打印完成后移除 iframe
      setTimeout(() => {
        document.body.removeChild(iframe)
      }, 1000)
    }, 300)
    
    return { success: true }
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "打开打印窗口失败" 
    }
  }
}

/**
 * 快捷导出函数 - 用于报告类内容
 */
export function exportReportToPdf(title: string, markdownContent: string): { success: boolean; error?: string } {
  return exportToPdf({
    title,
    content: markdownContent,
    isMarkdown: true,
  })
}
