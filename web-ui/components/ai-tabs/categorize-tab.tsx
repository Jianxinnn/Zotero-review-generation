"use client"

import { useState, useEffect, useRef } from "react"
import { Layers, Loader2, FileText, X, RotateCcw, Zap, AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Sparkles, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import type { Document } from "@/lib/types"
import { MarkdownRenderer } from "@/components/markdown-renderer"
import { exportReportToPdf } from "@/lib/export-pdf"

interface CategorizeTabProps {
  selectedDocIds: string[]
  documents: Document[]
  result: { title: string; summary: string } | null
  onUpdateResult: (result: { title: string; summary: string } | null) => void
  isExpanded?: boolean
}

type LoadingStage = "idle" | "preparing" | "streaming"

export function CategorizeTab({ 
  selectedDocIds, 
  documents, 
  result, 
  onUpdateResult, 
  isExpanded = false 
}: CategorizeTabProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [loadingStage, setLoadingStage] = useState<LoadingStage>("idle")
  const [copied, setCopied] = useState(false)
  const [progress, setProgress] = useState(0)
  const [streamingContent, setStreamingContent] = useState("")
  const [streamingTitle, setStreamingTitle] = useState("")
  const [isThinkingExpanded, setIsThinkingExpanded] = useState(false)
  const streamingRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const { toast } = useToast()


  // 检查是否有足够的摘要信息
  const selectedDocs = documents.filter(d => selectedDocIds.includes(d.id))
  const docsWithAbstract = selectedDocs.filter(d => d.abstract && d.abstract.trim().length > 0)
  const abstractCoverage = selectedDocs.length > 0 ? Math.round((docsWithAbstract.length / selectedDocs.length) * 100) : 0

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
    setLoadingStage("preparing")

    // 阶段1: 准备阶段 (0-20%) - 缩短准备时间
    const prepareTimer = setInterval(() => {
      setProgress(prev => {
        if (prev >= 20) {
          clearInterval(prepareTimer)
          setLoadingStage("streaming")
          return prev
        }
        return prev + Math.random() * 4
      })
    }, 150)

    return () => {
      clearInterval(prepareTimer)
    }
  }, [isLoading])

  // 流式输出时的进度更新
  useEffect(() => {
    if (loadingStage === "streaming" && streamingContent) {
      // 根据内容长度动态调整进度 (20-95%)
      const contentProgress = Math.min(95, 20 + (streamingContent.length / 40))
      setProgress(contentProgress)
    }
  }, [streamingContent, loadingStage])

  // 当接收到流式内容时，立即切换到 streaming 状态
  useEffect(() => {
    if (streamingContent && loadingStage === "preparing") {
      setLoadingStage("streaming")
      setProgress(20)
    }
  }, [streamingContent, loadingStage])

  // 流式生成时自动滚动到底部，始终展示最新内容
  useEffect(() => {
    if (!streamingRef.current) return
    if (!streamingContent) return
    if (loadingStage !== "streaming") return

    const el = streamingRef.current
    // 滚动到最新内容
    el.scrollTop = el.scrollHeight
  }, [streamingContent, loadingStage, isThinkingExpanded])

  const handleCategorize = async () => {
    if (selectedDocIds.length === 0) {
      toast({
        title: "提示",
        description: "请先选择至少一篇文献",
      })
      return
    }

    if (selectedDocIds.length < 2) {
      toast({
        title: "提示",
        description: "请至少选择2篇文献进行分类汇总",
      })
      return
    }

    // 清空之前的结果，这样重新分析时也能看到流式过程
    onUpdateResult(null)

    setIsLoading(true)
    setStreamingContent("")
    setStreamingTitle("")
    
    // 创建 AbortController 用于取消请求
    abortControllerRef.current = new AbortController()

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/quick-categorize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ doc_ids: selectedDocIds }),
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

          // 只在这里处理 JSON 解析错误
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
            console.log("[categorize] streaming chunk len:", content.length)
            setStreamingContent(content)
          } else if (data.type === "done") {
            onUpdateResult({ title, summary: content })
            setProgress(100)
          } else if (data.type === "error") {
            // 业务错误抛给外层 try/catch，由那里的 toast 统一处理
            throw new Error(data.content)
          }
        }
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        toast({
          title: "已取消",
          description: "分类汇总已取消",
        })
      } else {
        toast({
          title: "错误",
          description: error instanceof Error ? `分类汇总失败：${error.message}` : "分类汇总失败，请重试",
          variant: "destructive",
        })
      }
    } finally {
      setIsLoading(false)
      // 注意：不要在这里清空 streamingContent 和 streamingTitle
      // 因为流式输出完成后，用户可能还想看到内容
      // 只有在开始新的请求时才清空（在 handleCategorize 开头）
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
      a.download = `${result.title || "categorization"}.md`
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
    const title = result.title || "快速分类汇总"
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
        <div className="flex items-center justify-between border-b px-4 py-2 bg-gradient-to-r from-violet-500/5 to-fuchsia-500/5">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20">
              <Layers className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            </div>
            <span className="text-sm font-medium">快速分类汇总</span>
            <Badge variant="secondary" className="text-[10px] px-1.5">
              {selectedDocIds.length} 篇
            </Badge>
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
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={handleCategorize} disabled={isLoading}>
              <RotateCcw className={cn("h-3.5 w-3.5 mr-1", isLoading && "animate-spin")} />
              重新分析
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onUpdateResult(null)}>
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
    <div className="flex h-full flex-col p-4">
      {/* Feature Description */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20">
            <Zap className="h-5 w-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <p className="text-sm font-medium">快速分类汇总</p>
            <p className="text-xs text-muted-foreground">仅使用摘要，无需加载PDF</p>
          </div>
        </div>
        
        <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3 space-y-1.5">
          <p className="flex items-start gap-1.5">
            <span className="text-primary shrink-0 mt-0.5">•</span>
            <span>根据文献摘要自动识别研究主题，进行智能分类</span>
          </p>
          <p className="flex items-start gap-1.5">
            <span className="text-primary shrink-0 mt-0.5">•</span>
            <span>分析文献之间的联系和差异，生成知识图谱</span>
          </p>
          <p className="flex items-start gap-1.5">
            <span className="text-primary shrink-0 mt-0.5">•</span>
            <span>识别研究趋势和新兴方向</span>
          </p>
        </div>
      </div>

      {/* Selected Documents Info */}
      <div className="mt-4 rounded-lg border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">已选择文献</span>
          <span className={cn(
            "text-lg font-bold",
            selectedDocIds.length < 2 ? "text-muted-foreground" : "text-foreground"
          )}>
            {selectedDocIds.length} 篇
          </span>
        </div>
        
        {selectedDocIds.length >= 2 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">摘要覆盖率</span>
              <span className={cn(
                "font-medium",
                abstractCoverage >= 80 ? "text-green-600 dark:text-green-400" :
                abstractCoverage >= 50 ? "text-amber-600 dark:text-amber-400" :
                "text-red-600 dark:text-red-400"
              )}>
                {abstractCoverage}%
              </span>
            </div>
            <Progress value={abstractCoverage} className="h-1.5" />
            {abstractCoverage < 80 && (
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                部分文献缺少摘要，可能影响分析效果
              </p>
            )}
          </div>
        )}
      </div>

      {/* Generate Button */}
      <div className="mt-4 space-y-2">
        <Button
          onClick={handleCategorize}
          disabled={isLoading || selectedDocIds.length < 2}
          className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700"
          size="sm"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              正在分析...
            </>
          ) : (
            <>
              <Layers className="mr-2 h-4 w-4" />
              开始分类汇总
            </>
          )}
        </Button>
        {isLoading && (
          <div className="space-y-3 px-1">
            <div className="flex items-center gap-2 text-xs">
              <span className={cn(
                "flex items-center gap-1.5 transition-colors duration-300",
                loadingStage === "preparing" ? "text-primary font-medium" : "text-muted-foreground"
              )}>
                <span className={cn(
                  "w-5 h-5 rounded-full text-[10px] flex items-center justify-center transition-all duration-300",
                  loadingStage === "preparing" ? "bg-primary text-primary-foreground ring-2 ring-primary/20" :
                    progress >= 20 ? "bg-emerald-500 text-white" : "bg-muted"
                )}>
                  {progress >= 20 ? <CheckCircle2 className="h-3 w-3" /> : "1"}
                </span>
                准备数据
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
                AI 分析
              </span>
            </div>
            <Progress value={progress} className="h-1.5" />
            {loadingStage === "preparing" && (
              <p className="text-[10px] text-center text-muted-foreground">
                正在加载 {selectedDocIds.length} 篇文献的摘要信息...
              </p>
            )}
            {loadingStage === "streaming" && (
              <div className="mt-4">
                {/* 思考模式折叠卡片 */}
                <div className="rounded-lg border bg-gradient-to-br from-violet-500/5 to-fuchsia-500/5 overflow-hidden relative">
                  {/* 头部 - 可点击展开/折叠 */}
                  <button
                    onClick={() => setIsThinkingExpanded(!isThinkingExpanded)}
                    className="w-full px-3 py-2 flex items-center justify-between hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <Sparkles className="h-3.5 w-3.5 text-violet-500" />
                        <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-violet-500 rounded-full animate-ping" />
                      </div>
                      <span className="text-xs font-medium text-foreground">
                        {streamingTitle || "正在分析中..."}
                      </span>
                      {streamingContent && (
                        <span className="text-[10px] text-muted-foreground">
                          {streamingContent.length} 字符
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Loader2 className="h-3 w-3 animate-spin text-violet-500" />
                      {isThinkingExpanded ? (
                        <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </div>
                  </button>
                  
                  {/* 内容区域 */}
                  <div
                    className={cn(
                      "px-3 pb-3 transition-all duration-300 ease-in-out overflow-hidden",
                      isThinkingExpanded ? "max-h-80" : "max-h-40"
                    )}
                  >
                    {streamingContent && streamingContent.trim().length > 0 ? (
                      <div className="relative h-full">
                        <div
                          ref={streamingRef}
                          className={cn(
                            "text-xs text-muted-foreground leading-relaxed overflow-y-auto pr-1 [&>*:first-child]:mt-0",
                            isThinkingExpanded ? "max-h-72" : "max-h-32"
                          )}
                        >
                          <MarkdownRenderer content={streamingContent} className="text-xs" />
                        </div>
                        {/* 顶部 / 底部渐变遮罩（未展开时，营造向上渐隐效果） */}
                        {!isThinkingExpanded && (
                          <>
                            <div className="pointer-events-none absolute top-0 left-0 right-0 h-6 bg-gradient-to-b from-background/80 to-transparent" />
                            <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-background/80 to-transparent" />
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 py-2">
                        <div className="flex gap-1">
                          <span className="w-1.5 h-1.5 bg-violet-500/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-1.5 h-1.5 bg-violet-500/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-1.5 h-1.5 bg-violet-500/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                        <span className="text-[10px] text-muted-foreground">正在等待 AI 响应...</span>
                      </div>
                    )}
                  </div>
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
      {selectedDocIds.length < 2 && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <FileText className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p className="text-xs">
              {selectedDocIds.length === 0 
                ? "请先在左侧选择需要分析的文献" 
                : "请至少选择 2 篇文献进行分类汇总"}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
