"use client"

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize from 'rehype-sanitize'
import { cn } from '@/lib/utils'

interface MarkdownRendererProps {
  content: string
  className?: string
  variant?: "default" | "compact"
}

export function MarkdownRenderer({ content, className, variant = "default" }: MarkdownRendererProps) {
  const compact = variant === "compact"
  
  return (
    <div className={cn("markdown-content", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, rehypeSanitize]}
        components={{
          // 标题
          h1: ({ node, ...props }) => (
            <h1 className="text-2xl font-bold mt-6 mb-4 pb-2 border-b border-border" {...props} />
          ),
          h2: ({ node, ...props }) => (
            <h2 className="text-xl font-semibold mt-5 mb-3 pb-1.5 border-b border-border/50" {...props} />
          ),
          h3: ({ node, ...props }) => (
            <h3 className="text-lg font-semibold mt-4 mb-2" {...props} />
          ),
          h4: ({ node, ...props }) => (
            <h4 className="text-base font-semibold mt-3 mb-2" {...props} />
          ),
          
          // 段落
          p: ({ node, ...props }) => (
            <p className={cn(
              "text-foreground/90",
              compact ? "my-2 leading-6 text-sm" : "my-3 leading-7"
            )} {...props} />
          ),
          
          // 列表
          ul: ({ node, ...props }) => (
            <ul className={cn(
              "ml-6 list-disc text-foreground/90",
              compact ? "my-2 space-y-1" : "my-3 space-y-1.5"
            )} {...props} />
          ),
          ol: ({ node, ...props }) => (
            <ol className={cn(
              "ml-6 list-decimal text-foreground/90",
              compact ? "my-2 space-y-1" : "my-3 space-y-1.5"
            )} {...props} />
          ),
          li: ({ node, ...props }) => (
            <li className={cn(compact ? "leading-6" : "leading-7")} {...props} />
          ),
          
          // 引用
          blockquote: ({ node, ...props }) => (
            <blockquote 
              className={cn(
                "border-l border-primary/50 bg-muted/30 text-foreground/85 rounded-md",
                compact
                  ? "my-2 pl-3 pr-2 py-1.5 text-sm leading-6"
                  : "my-4 border-l-4 pl-4 py-2 italic"
              )} 
              {...props} 
            />
          ),
          
          // 代码块
          code: ({ node, inline, className, children, ...props }: any) => {
            // 智能检测：如果内容很短且没有换行，强制作为行内代码渲染
            // 这可以修复 AI 错误地将短变量（如 "z"）输出为代码块导致布局断裂的问题
            const content = String(children).trim();
            const isShort = content.length < 50 && !content.includes('\n');
            const shouldBeInline = inline || isShort;

            if (shouldBeInline) {
              return (
                <code 
                  className="px-1.5 py-0.5 rounded bg-muted/40 text-[0.95em] text-foreground break-all" 
                  style={{ 
                    fontFamily: '"KaTeX_Main", "Times New Roman", Times, serif',
                    letterSpacing: '0.01em'
                  }}
                  {...props}
                >
                  {children}
                </code>
              )
            }
            return (
              <code 
                className={cn(
                  "block p-3 rounded-lg bg-muted/50 text-sm font-mono overflow-x-auto border border-border/50",
                  className
                )}
                {...props}
              >
                {children}
              </code>
            )
          },
          pre: ({ node, ...props }) => (
            <pre className="my-2 overflow-x-auto" {...props} />
          ),
          
          // 表格
          table: ({ node, ...props }) => (
            <div className="my-4 overflow-x-auto">
              <table className="w-full border-collapse border border-border rounded-lg" {...props} />
            </div>
          ),
          thead: ({ node, ...props }) => (
            <thead className="bg-muted/50" {...props} />
          ),
          tbody: ({ node, ...props }) => (
            <tbody {...props} />
          ),
          tr: ({ node, ...props }) => (
            <tr className="border-b border-border last:border-0" {...props} />
          ),
          th: ({ node, ...props }) => (
            <th className="px-4 py-2 text-left font-semibold text-sm border border-border" {...props} />
          ),
          td: ({ node, ...props }) => (
            <td className="px-4 py-2 text-sm border border-border align-top" {...props} />
          ),
          
          // 链接
          a: ({ node, ...props }) => (
            <a 
              className="text-primary hover:underline font-medium" 
              target="_blank" 
              rel="noopener noreferrer" 
              {...props} 
            />
          ),
          
          // 强调
          strong: ({ node, ...props }) => (
            <strong className="font-semibold text-foreground" {...props} />
          ),
          em: ({ node, ...props }) => (
            <em className="italic" {...props} />
          ),
          
          // 分隔线
          hr: ({ node, ...props }) => (
            <hr className="my-6 border-t border-border" {...props} />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
