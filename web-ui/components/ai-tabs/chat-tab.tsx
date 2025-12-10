"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Send, Loader2, User, Bot, Trash2, MessageSquare, Sparkles, StopCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import type { Document, ChatMessage } from "@/lib/types"
import { apiPostStream, cancelRequest } from "@/lib/api"

interface ChatTabProps {
  selectedDocIds: string[]
  documents: Document[]
  messages: ChatMessage[]
  onUpdateMessages: (messages: ChatMessage[]) => void
  isExpanded?: boolean
}

const CHAT_REQUEST_KEY = 'chat_stream'

export function ChatTab({ selectedDocIds, documents, messages, onUpdateMessages, isExpanded = false }: ChatTabProps) {
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [streamingContent, setStreamingContent] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()

  // 自动滚动到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, streamingContent])

  // 取消请求
  const handleCancel = useCallback(() => {
    cancelRequest(CHAT_REQUEST_KEY)
    setIsLoading(false)
    setStreamingContent("")
  }, [])

  // 组件卸载时取消请求
  useEffect(() => {
    return () => {
      cancelRequest(CHAT_REQUEST_KEY)
    }
  }, [])

  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: ChatMessage = { role: "user", content: input.trim() }
    const updatedMessages = [...messages, userMessage]
    onUpdateMessages(updatedMessages)
    setInput("")
    setIsLoading(true)
    setStreamingContent("")

    let accumulatedContent = ""

    await apiPostStream(
      "/api/chat",
      {
        message: userMessage.content,
        doc_ids: selectedDocIds,
        history: messages,
      },
      {
        key: CHAT_REQUEST_KEY,
        onStart: () => {
          // 流式开始
        },
        onContent: (chunk) => {
          accumulatedContent += chunk
          setStreamingContent(accumulatedContent)
        },
        onDone: () => {
          // 完成，将累积的内容添加到消息列表
          if (accumulatedContent) {
            const assistantMessage: ChatMessage = { role: "assistant", content: accumulatedContent }
            onUpdateMessages([...updatedMessages, assistantMessage])
          }
          setStreamingContent("")
          setIsLoading(false)
        },
        onError: (error) => {
          toast({
            title: "错误",
            description: `消息发送失败：${error}`,
            variant: "destructive",
          })
          setStreamingContent("")
          setIsLoading(false)
        }
      }
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header with context info */}
      <div className="flex items-center justify-between border-b border-border/50 px-4 py-2 bg-muted/30 backdrop-blur-sm">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <MessageSquare className="h-4 w-4 text-primary" />
          <span className="text-xs font-medium truncate">
            {selectedDocIds.length > 0 ? (
              <>
                基于 <span className="text-primary font-semibold">{selectedDocIds.length}</span> 篇文献对话
              </>
            ) : (
              "智能对话"
            )}
          </span>
        </div>
        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={() => onUpdateMessages([])}
          >
            <Trash2 className="h-3 w-3 mr-1" />
            清空
          </Button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center p-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center mb-4 shadow-inner">
              <Bot className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">开始与 AI 对话</h3>
            <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
              {selectedDocIds.length > 0
                ? `已准备好基于 ${selectedDocIds.length} 篇文献回答您的问题`
                : "您可以询问关于文献的任何问题，或者让 AI 帮您分析研究思路"
              }
            </p>
            {selectedDocIds.length === 0 && (
              <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full">
                <Sparkles className="h-3 w-3 text-amber-500" />
                <span>建议先在左侧选择文献以获得更精准的回答</span>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {messages.map((msg, idx) => (
              <div key={idx} className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "justify-start")}>
                {msg.role === "assistant" && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-purple-600 shadow-md mt-1">
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                )}

                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-3 shadow-sm",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-tr-sm"
                      : "bg-card border border-border/50 rounded-tl-sm"
                  )}
                >
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
                </div>

                {msg.role === "user" && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted shadow-sm mt-1">
                    <User className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
              </div>
            ))}

            {/* 流式输出显示 */}
            {(isLoading || streamingContent) && (
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-purple-600 shadow-md mt-1">
                  <Bot className="h-4 w-4 text-white" />
                </div>
                <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-card border border-border/50 px-4 py-3 shadow-sm">
                  {streamingContent ? (
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">
                      {streamingContent}
                      <span className="inline-block w-2 h-4 ml-1 bg-primary/60 animate-pulse" />
                    </p>
                  ) : (
                    <div className="flex gap-1.5">
                      <span className="w-2 h-2 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-2 h-2 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-2 h-2 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 bg-background/50 backdrop-blur-md border-t border-border/50">
        <div className="relative flex gap-2 items-end bg-card border border-border/50 rounded-xl p-2 shadow-sm focus-within:ring-1 focus-within:ring-primary/30 focus-within:border-primary/50 transition-all">
          <Textarea
            placeholder="输入你的问题..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            rows={1}
            className="resize-none text-sm min-h-[40px] max-h-32 border-0 bg-transparent shadow-none focus-visible:ring-0 py-2.5 px-3"
          />
          {isLoading ? (
            <Button
              onClick={handleCancel}
              size="icon"
              variant="destructive"
              className="h-9 w-9 shrink-0 mb-0.5 rounded-lg shadow-sm transition-all"
              title="停止生成"
            >
              <StopCircle className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={handleSend}
              disabled={!input.trim()}
              size="icon"
              className="h-9 w-9 shrink-0 mb-0.5 rounded-lg bg-primary hover:bg-primary/90 shadow-sm transition-all"
            >
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>
        <p className="mt-2 text-[10px] text-muted-foreground text-center opacity-70">
          Enter 发送 · Shift+Enter 换行
        </p>
      </div>
    </div>
  )
}
