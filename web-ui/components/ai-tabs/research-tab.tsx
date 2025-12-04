"use client"

import { useState, useEffect, useRef } from "react"
import { FlaskConical, Loader2, X, RotateCcw, Lightbulb, FileText, CheckCircle2, ChevronDown, ChevronUp, Sparkles, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import type { Document } from "@/lib/types"
import { MarkdownRenderer } from "@/components/markdown-renderer"
import { exportReportToPdf } from "@/lib/export-pdf"

interface ResearchTabProps {
  selectedDocIds: string[]
  documents: Document[]
  report: string | null
  question: string
  onUpdateReport: (report: string | null, question: string) => void
  isExpanded?: boolean
}

const EXAMPLE_QUESTIONS = [
  "这些文献的主要研究发现是什么？",
  "各文献使用了哪些研究方法？有何异同？",
  "这些研究存在哪些局限性和未来方向？",
]

type LoadingStage = "idle" | "loading_pdf" | "streaming"

export function ResearchTab({ selectedDocIds, documents, report, question: savedQuestion, onUpdateReport, isExpanded = false }: ResearchTabProps) {
  const [localQuestion, setLocalQuestion] = useState(savedQuestion)
  const [isLoading, setIsLoading] = useState(false)
  const [loadingStage, setLoadingStage] = useState<LoadingStage>("idle")
  const [currentQuestion, setCurrentQuestion] = useState<string>(savedQuestion)
  const [progress, setProgress] = useState(0)
  const [streamingContent, setStreamingContent] = useState("")
  const [isThinkingExpanded, setIsThinkingExpanded] = useState(false)
  const abortControllerRef = useRef<AbortController | null>(null)
  const { toast } = useToast()


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

  const handleResearch = async () => {
    if (selectedDocIds.length === 0) {
      toast({
        title: "提示",
        description: "请先选择至少一篇文献",
      })
      return
    }

    if (!localQuestion.trim()) {
      toast({
        title: "提示",
        description: "请输入研究问题",
      })
      return
    }

    const trimmedQuestion = localQuestion.trim()
    setCurrentQuestion(trimmedQuestion)
    // 清空之前的结果，这样重新生成时也能看到流式过程
    onUpdateReport(null, trimmedQuestion)
    setIsLoading(true)
    setStreamingContent("")
    abortControllerRef.current = new AbortController()

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/research`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          doc_ids: selectedDocIds,
          question: trimmedQuestion,
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
            // 收到标题后立即切换到流式状态
            setLoadingStage("streaming")
          } else if (data.type === "content") {
            content += data.content
            setStreamingContent(content)
          } else if (data.type === "done") {
            onUpdateReport(content, localQuestion.trim())
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
          description: "研究报告生成已取消",
        })
      } else {
        toast({
          title: "错误",
          description: error instanceof Error ? `生成报告失败：${error.message}` : "生成报告失败，请重试",
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
    if (!report) return
    const title = currentQuestion || "研究报告"
    const text = `# ${title}\n\n${report}`
    try {
      const blob = new Blob([text], { type: "text/markdown;charset=utf-8" })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${title}.md`
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
    if (!report) return
    const title = currentQuestion || "研究报告"
    const content = report

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
  if (report) {
    return (
      <div className="flex h-full flex-col">
        {/* Report Header */}
        <div className="flex items-center justify-between border-b px-4 py-2 bg-muted/30">
          <div className="flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">研究报告</span>
            <span className="text-xs text-muted-foreground">· {selectedDocIds.length} 篇文献</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={exportAsMarkdown}
            >
              <Download className="h-3.5 w-3.5 mr-1" />
              导出 MD
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={exportAsPdf}
            >
              <Download className="h-3.5 w-3.5 mr-1" />
              导出 PDF
            </Button>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={handleResearch} disabled={isLoading}>
              <RotateCcw className={cn("h-3.5 w-3.5 mr-1", isLoading && "animate-spin")} />
              重新生成
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onUpdateReport(null, currentQuestion)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        
        {/* Report Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 max-w-5xl mx-auto space-y-4">
            <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
              <p className="text-xs text-muted-foreground mb-1">研究问题</p>
              <p className="text-sm font-medium">{currentQuestion}</p>
            </div>
            <MarkdownRenderer content={report} />
          </div>
        </div>
      </div>
    )
  }

  // 无结果时显示输入面板
  return (
    <div className="flex h-full flex-col p-4">
      {/* Question Input */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">研究问题</p>
        <Textarea
          placeholder="输入你想深入研究的问题..."
          value={localQuestion}
          onChange={(e) => setLocalQuestion(e.target.value)}
          rows={2}
          className="resize-none text-sm"
        />
      </div>

      {/* Example Questions */}
      <div className="mt-3 space-y-1.5">
        <p className="text-[10px] text-muted-foreground">示例问题：</p>
        <div className="flex flex-wrap gap-1.5">
          {EXAMPLE_QUESTIONS.map((q, i) => (
            <button
              key={i}
              onClick={() => setLocalQuestion(q)}
              className="rounded-full bg-muted/50 px-2.5 py-1 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Selected Documents */}
      <div className="mt-4 rounded-lg bg-muted/50 p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground">已选择文献</span>
          <span className={cn(
            "text-sm font-semibold",
            selectedDocIds.length === 0 ? "text-muted-foreground" : "text-foreground"
          )}>
            {selectedDocIds.length} 篇
          </span>
        </div>
        {selectedDocIds.length > 0 && (
          <div className="space-y-1 max-h-20 overflow-y-auto">
            {selectedDocIds.slice(0, 3).map((id) => {
              const doc = documents.find((d) => d.id === id)
              return doc ? (
                <p key={id} className="truncate text-[10px] text-muted-foreground flex items-center gap-1">
                  <FileText className="h-2.5 w-2.5 shrink-0" />
                  {doc.title}
                </p>
              ) : null
            })}
            {selectedDocIds.length > 3 && (
              <p className="text-[10px] text-muted-foreground">... 还有 {selectedDocIds.length - 3} 篇</p>
            )}
          </div>
        )}
      </div>

      {/* Generate Button */}
      <div className="mt-4 space-y-2">
        <Button
          onClick={handleResearch}
          disabled={isLoading || selectedDocIds.length === 0 || !localQuestion.trim()}
          className="w-full"
          size="sm"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              正在研究...
            </>
          ) : (
            <>
              <FlaskConical className="mr-2 h-4 w-4" />
              开始深度研究
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
                <div className="rounded-lg border bg-gradient-to-br from-amber-500/5 to-orange-500/5 overflow-hidden relative">
                  {/* 头部 - 可点击展开/折叠 */}
                  <button
                    onClick={() => setIsThinkingExpanded(!isThinkingExpanded)}
                    className="w-full px-3 py-2 flex items-center justify-between hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <FlaskConical className="h-3.5 w-3.5 text-amber-500" />
                        <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-amber-500 rounded-full animate-ping" />
                      </div>
                      <span className="text-xs font-medium text-foreground">
                        正在深度研究中...
                      </span>
                      {streamingContent && (
                        <span className="text-[10px] text-muted-foreground">
                          {streamingContent.length} 字符
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Loader2 className="h-3 w-3 animate-spin text-amber-500" />
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
                          <span className="w-1.5 h-1.5 bg-amber-500/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-1.5 h-1.5 bg-amber-500/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-1.5 h-1.5 bg-amber-500/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
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

      {/* Empty State */}
      {selectedDocIds.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <FlaskConical className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p className="text-xs">请先在左侧选择需要研究的文献</p>
          </div>
        </div>
      )}
    </div>
  )
}
