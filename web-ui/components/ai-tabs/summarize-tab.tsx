"use client"

import { useState, useEffect, useRef } from "react"
import { Sparkles, Loader2, FileText, Zap, ListChecks, X, RotateCcw, CheckCircle2, ChevronDown, ChevronUp, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import type { Document } from "@/lib/types"
import { MarkdownRenderer } from "@/components/markdown-renderer"
import { exportReportToPdf } from "@/lib/export-pdf"

type SummaryType = "full" | "quick" | "key_points"

interface SummarizeTabProps {
  selectedDocIds: string[]
  documents: Document[]
  result: { title: string; summary: string } | null
  summaryType: SummaryType
  onUpdateResult: (result: { title: string; summary: string } | null, type: SummaryType) => void
  isExpanded?: boolean
}

const SUMMARY_TYPES = [
  { value: "full", label: "完整总结", desc: "详细分析", icon: FileText },
  { value: "quick", label: "快速摘要", desc: "简明概述", icon: Zap },
  { value: "key_points", label: "关键点", desc: "核心要点", icon: ListChecks },
] as const

type LoadingStage = "idle" | "loading_pdf" | "streaming"

export function SummarizeTab({ selectedDocIds, documents, result, summaryType, onUpdateResult, isExpanded = false }: SummarizeTabProps) {
  const [localSummaryType, setLocalSummaryType] = useState<SummaryType>(summaryType)
  const [isLoading, setIsLoading] = useState(false)
  const [loadingStage, setLoadingStage] = useState<LoadingStage>("idle")
  const [progress, setProgress] = useState(0)
  const [streamingContent, setStreamingContent] = useState("")
  const [streamingTitle, setStreamingTitle] = useState("")
  const [isThinkingExpanded, setIsThinkingExpanded] = useState(false)
  const abortControllerRef = useRef<AbortController | null>(null)
  const { toast } = useToast()


  // 同步 summaryType 到父组件
  const handleSetSummaryType = (type: SummaryType) => {
    setLocalSummaryType(type)
    onUpdateResult(result, type)
  }

  // 进度条动画 - 分阶段
  useEffect(() => {
    if (!isLoading) {
      setProgress(100)
      const timer = setTimeout(() => {
        setProgress(0)
        setLoadingStage("idle")
      }, 300)
      return () => clearTimeout(timer)
    }

    setProgress(0)
    setLoadingStage("loading_pdf")

    // 阶段1: 加载 PDF (0-25%) - 缩短加载时间
    const loadTimer = setInterval(() => {
      setProgress(prev => {
        if (prev >= 25) {
          clearInterval(loadTimer)
          setLoadingStage("streaming")
          return prev
        }
        return prev + Math.random() * 5
      })
    }, 150)

    return () => {
      clearInterval(loadTimer)
    }
  }, [isLoading])

  // 流式输出时的进度更新
  useEffect(() => {
    if (loadingStage === "streaming" && streamingContent) {
      const contentProgress = Math.min(95, 25 + (streamingContent.length / 40))
      setProgress(contentProgress)
    }
  }, [streamingContent, loadingStage])

  // 当接收到流式内容时，立即切换到 streaming 状态
  useEffect(() => {
    if (streamingContent && loadingStage === "loading_pdf") {
      setLoadingStage("streaming")
      setProgress(25)
    }
  }, [streamingContent, loadingStage])

  const handleSummarize = async () => {
    if (selectedDocIds.length === 0) {
      toast({
        title: "提示",
        description: "请先选择至少一篇文献",
      })
      return
    }

    // 清空之前的结果，这样重新生成时也能看到流式过程
    onUpdateResult(null, localSummaryType)

    setIsLoading(true)
    setStreamingContent("")
    setStreamingTitle("")
    abortControllerRef.current = new AbortController()

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/summarize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          doc_ids: selectedDocIds,
          summary_type: localSummaryType,
        }),
        signal: abortControllerRef.current.signal,
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error('无法读取响应流')
      }

      let buffer = ''
      let title = ''
      let content = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const rawLine of lines) {
          const line = rawLine.trim()
          if (!line.startsWith("data:")) continue

          let data: any
          try {
            // 兼容形如 "data: {...}" 或 "data:{...}"，并去掉可能的多余空白
            const jsonStr = line.replace(/^data:\s*/, "")
            data = JSON.parse(jsonStr)
          } catch (e) {
            console.error("解析 SSE 数据失败:", e)
            continue
          }

          if (data.type === "title") {
            title = data.content
            setStreamingTitle(title)
            // 收到标题后立即切换到流式状态
            setLoadingStage("streaming")
          } else if (data.type === "content") {
            content += data.content
            setStreamingContent(content)
          } else if (data.type === "done") {
            onUpdateResult({ title, summary: content }, localSummaryType)
            setProgress(100)
          } else if (data.type === "error") {
            // 抛给外层，让统一的错误 toast 处理
            throw new Error(data.content)
          }
        }
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        toast({
          title: "已取消",
          description: "总结生成已取消",
        })
      } else {
        toast({
          title: "错误",
          description: error instanceof Error ? `生成总结失败：${error.message}` : "生成总结失败，请重试",
          variant: "destructive",
        })
      }
    } finally {
      setIsLoading(false)
      // 不要在这里清空流式内容，让用户能看到输出过程
      setIsThinkingExpanded(false)
      abortControllerRef.current = null
    }
  }

  const exportAsMarkdown = () => {
    if (!result) return
    const text = `# ${result.title}\n\n${result.summary}`
    try {
      const blob = new Blob([text], { type: "text/markdown;charset=utf-8" })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${result.title || "summary"}.md`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      toast({ title: "已导出 Markdown" })
    } catch (e) {
      toast({
        title: "导出失败",
        description: "导出 Markdown 失败，请稍后重试",
        variant: "destructive",
      })
    }
  }

  const exportAsPdf = () => {
    if (!result) return
    const title = result.title || "文献总结"
    const content = result.summary || ""

    const { success, error } = exportReportToPdf(title, content)
    if (success) {
      toast({ title: "已打开打印窗口，可选择保存为 PDF" })
    } else {
      toast({
        title: "导出失败",
        description: error || "打开打印窗口失败，请稍后重试",
        variant: "destructive",
      })
    }
  }

  // 有结果时显示报告视图
  if (result) {
    return (
      <div className="flex h-full flex-col">
        {/* Report Header */}
        <div className="flex items-center justify-between border-b border-border/50 px-4 py-2 bg-muted/30 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">AI 总结</span>
            <span className="text-xs text-muted-foreground">· {selectedDocIds.length} 篇文献</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs hover:bg-background/80"
              onClick={exportAsMarkdown}
            >
              <Download className="h-3.5 w-3.5 mr-1" />
              导出 MD
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs hover:bg-background/80"
              onClick={exportAsPdf}
            >
              <Download className="h-3.5 w-3.5 mr-1" />
              导出 PDF
            </Button>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs hover:bg-background/80" onClick={handleSummarize} disabled={isLoading}>
              <RotateCcw className={cn("h-3.5 w-3.5 mr-1", isLoading && "animate-spin")} />
              重新生成
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-background/80" onClick={() => onUpdateResult(null, localSummaryType)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Report Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 max-w-5xl mx-auto">
            <MarkdownRenderer content={result.summary} />
          </div>
        </div>
      </div>
    )
  }

  // 无结果时显示配置面板
  return (
    <div className="flex h-full flex-col p-6 max-w-2xl mx-auto w-full">
      <div className="flex-1 flex flex-col justify-center space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary mb-2">
            <Sparkles className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-semibold">智能文献总结</h3>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            选择文献并生成智能摘要，快速掌握核心内容
          </p>
        </div>

        {/* Summary Type Selection */}
        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground text-center">选择总结类型</p>
          <div className="grid grid-cols-3 gap-3">
            {SUMMARY_TYPES.map(({ value, label, desc, icon: Icon }) => (
              <button
                key={value}
                onClick={() => handleSetSummaryType(value)}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-xl border p-4 transition-all text-center hover:shadow-md",
                  localSummaryType === value
                    ? "border-primary bg-primary/5 text-primary shadow-sm"
                    : "border-border bg-card hover:border-primary/30 hover:bg-muted/50"
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="text-xs font-medium">{label}</span>
                <span className="text-[10px] text-muted-foreground/80">{desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Selected Documents Info */}
        <div className="rounded-xl border bg-card/50 p-4 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">已选择文献</span>
            <span className={cn(
              "text-sm font-semibold",
              selectedDocIds.length === 0 ? "text-muted-foreground" : "text-foreground"
            )}>
              {selectedDocIds.length} 篇
            </span>
          </div>
          {selectedDocIds.length > 1 && (
            <p className="mt-2 text-[10px] text-muted-foreground border-t border-border/50 pt-2">
              将对多篇文献进行综合分析，提取共同点与差异
            </p>
          )}
        </div>

        {/* Generate Button */}
        <div className="space-y-4">
          <Button
            onClick={handleSummarize}
            disabled={isLoading || selectedDocIds.length === 0}
            className="w-full h-10 text-sm shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all"
            size="lg"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                正在生成...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                生成总结
              </>
            )}
          </Button>

          {isLoading && (
            <div className="space-y-3 px-1">
              <div className="flex items-center gap-2 text-xs">
                <span className={cn(
                  "flex items-center gap-1.5 transition-colors duration-300",
                  loadingStage === "loading_pdf" ? "text-primary font-medium" : "text-muted-foreground"
                )}>
                  <span className={cn(
                    "w-5 h-5 rounded-full text-[10px] flex items-center justify-center transition-all duration-300",
                    loadingStage === "loading_pdf" ? "bg-primary text-primary-foreground ring-2 ring-primary/20" :
                      progress >= 25 ? "bg-emerald-500 text-white" : "bg-muted"
                  )}>
                    {progress >= 25 ? <CheckCircle2 className="h-3 w-3" /> : "1"}
                  </span>
                  加载 PDF
                </span>
                <div className="flex-1 h-px bg-border" />
                <span className={cn(
                  "flex items-center gap-1.5 transition-colors duration-300",
                  loadingStage === "streaming" ? "text-primary font-medium" : "text-muted-foreground"
                )}>
                  <span className={cn(
                    "w-5 h-5 rounded-full text-[10px] flex items-center justify-center transition-all duration-300",
                    loadingStage === "streaming" ? "bg-primary text-primary-foreground ring-2 ring-primary/20" : "bg-muted"
                  )}>
                    2
                  </span>
                  AI 生成
                </span>
              </div>
              <Progress value={progress} className="h-1.5" />
              {loadingStage === "loading_pdf" && (
                <p className="text-[10px] text-center text-muted-foreground">
                  正在加载 {selectedDocIds.length} 篇文献的 PDF 内容...
                </p>
              )}
              {loadingStage === "streaming" && (
                <div className="mt-4">
                  {/* 思考模式折叠卡片 */}
                  <div className="rounded-lg border bg-gradient-to-br from-primary/5 to-primary/10 overflow-hidden relative">
                    {/* 头部 - 可点击展开/折叠 */}
                    <button
                      onClick={() => setIsThinkingExpanded(!isThinkingExpanded)}
                      className="w-full px-3 py-2 flex items-center justify-between hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <Sparkles className="h-3.5 w-3.5 text-primary" />
                          <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-primary rounded-full animate-ping" />
                        </div>
                        <span className="text-xs font-medium text-foreground">
                          {streamingTitle || "正在生成中..."}
                        </span>
                        {streamingContent && (
                          <span className="text-[10px] text-muted-foreground">
                            {streamingContent.length} 字符
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Loader2 className="h-3 w-3 animate-spin text-primary" />
                        {isThinkingExpanded ? (
                          <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                      </div>
                    </button>
                    
                    {/* 内容区域 */}
                    <div className={cn(
                      "px-3 pb-3 transition-all duration-300 ease-in-out overflow-hidden",
                      isThinkingExpanded ? "max-h-80" : "max-h-24"
                    )}>
                      {streamingContent && streamingContent.trim().length > 0 ? (
                        <div className={cn(
                          "text-xs text-muted-foreground leading-relaxed overflow-y-auto [&>*:first-child]:mt-0",
                          isThinkingExpanded ? "max-h-72" : "max-h-20"
                        )}>
                          <MarkdownRenderer content={streamingContent} className="text-xs" />
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 py-2">
                          <div className="flex gap-1">
                            <span className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <span className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <span className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                          </div>
                          <span className="text-[10px] text-muted-foreground">正在等待 AI 响应...</span>
                        </div>
                      )}
                    </div>
                    
                    {/* 底部渐变遮罩（未展开时） */}
                    {!isThinkingExpanded && streamingContent && (
                      <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-background/90 to-transparent pointer-events-none" />
                    )}
                  </div>
                  
                  {/* 展开/收起提示 */}
                  {streamingContent && !isThinkingExpanded && (
                    <p className="text-[10px] text-center text-muted-foreground mt-1">
                      点击展开查看完整内容
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
