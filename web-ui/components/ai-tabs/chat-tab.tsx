"use client"

import { useState, useRef, useEffect } from "react"
import { Send, Loader2, User, Bot, Trash2, MessageSquare, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import type { Document, ChatMessage } from "@/lib/types"
import { apiPost } from "@/lib/api"

interface ChatTabProps {
  selectedDocIds: string[]
  documents: Document[]
  messages: ChatMessage[]
  onUpdateMessages: (messages: ChatMessage[]) => void
  isExpanded?: boolean
}

export function ChatTab({ selectedDocIds, documents, messages, onUpdateMessages, isExpanded = false }: ChatTabProps) {
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleSend = async () => {
    if (!input.trim()) return

    const userMessage: ChatMessage = { role: "user", content: input.trim() }
    const updatedMessages = [...messages, userMessage]
    onUpdateMessages(updatedMessages)
    setInput("")
    setIsLoading(true)

    try {
      const data = await apiPost<{ response: string }, { message: string; doc_ids: string[]; history: ChatMessage[] }>(
        "/api/chat",
        {
          message: userMessage.content,
          doc_ids: selectedDocIds,
          history: messages,
        },
      )
      const assistantMessage: ChatMessage = { role: "assistant", content: data.response }
      onUpdateMessages([...updatedMessages, assistantMessage])
    } catch (error) {
      toast({
        title: "错误",
        description:
          error instanceof Error ? `消息发送失败：${error.message}` : "消息发送失败，请重试",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
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

            {isLoading && (
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-purple-600 shadow-md mt-1">
                  <Bot className="h-4 w-4 text-white" />
                </div>
                <div className="flex items-center rounded-2xl rounded-tl-sm bg-card border border-border/50 px-4 py-3 shadow-sm">
                  <div className="flex gap-1.5">
                    <span className="w-2 h-2 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
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
          <Button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            size="icon"
            className="h-9 w-9 shrink-0 mb-0.5 rounded-lg bg-primary hover:bg-primary/90 shadow-sm transition-all"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="mt-2 text-[10px] text-muted-foreground text-center opacity-70">
          Enter 发送 · Shift+Enter 换行
        </p>
      </div>
    </div>
  )
}
