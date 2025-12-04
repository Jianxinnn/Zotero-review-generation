"use client"

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@/lib/utils'

interface MarkdownRendererProps {
  content: string
  className?: string
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  return (
    <div className={cn("markdown-content", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
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
            <p className="my-3 leading-7 text-foreground/90" {...props} />
          ),
          
          // 列表
          ul: ({ node, ...props }) => (
            <ul className="my-3 ml-6 list-disc space-y-1.5 text-foreground/90" {...props} />
          ),
          ol: ({ node, ...props }) => (
            <ol className="my-3 ml-6 list-decimal space-y-1.5 text-foreground/90" {...props} />
          ),
          li: ({ node, ...props }) => (
            <li className="leading-7" {...props} />
          ),
          
          // 引用
          blockquote: ({ node, ...props }) => (
            <blockquote 
              className="my-4 border-l-4 border-primary/50 pl-4 py-2 bg-muted/30 italic text-foreground/80" 
              {...props} 
            />
          ),
          
          // 代码块
          code: ({ node, inline, className, children, ...props }: any) => {
            if (inline) {
              return (
                <code 
                  className="px-1.5 py-0.5 rounded bg-muted text-sm font-mono text-primary" 
                  {...props}
                >
                  {children}
                </code>
              )
            }
            return (
              <code 
                className={cn(
                  "block my-4 p-4 rounded-lg bg-muted/50 text-sm font-mono overflow-x-auto border border-border/50",
                  className
                )}
                {...props}
              >
                {children}
              </code>
            )
          },
          pre: ({ node, ...props }) => (
            <pre className="my-4 overflow-x-auto" {...props} />
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
            <th className="px-4 py-2 text-left font-semibold text-sm" {...props} />
          ),
          td: ({ node, ...props }) => (
            <td className="px-4 py-2 text-sm" {...props} />
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
