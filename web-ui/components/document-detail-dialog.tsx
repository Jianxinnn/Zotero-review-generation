"use client"

import { useState, useEffect } from "react"
import dynamic from "next/dynamic"
import {
  FileText, Calendar, BookOpen, Tag,
  File, Users, Hash, Copy, Check, X,
  Globe, Clock, ExternalLink, FileX, Eye
} from "lucide-react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import type { Document } from "@/lib/types"

// 动态导入 PDF 查看器，禁用 SSR
const PdfViewer = dynamic(
  () => import("@/components/pdf-viewer").then(mod => mod.PdfViewer),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full bg-muted/20">
        <div className="text-center">
          <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2 animate-pulse" />
          <p className="text-sm text-muted-foreground">加载 PDF 查看器...</p>
        </div>
      </div>
    )
  }
)

interface DocumentDetailDialogProps {
  document: Document | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

// 复制按钮组件
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-5 w-5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
      onClick={handleCopy}
    >
      {copied ? (
        <Check className="h-3 w-3 text-green-500" />
      ) : (
        <Copy className="h-3 w-3 text-muted-foreground" />
      )}
    </Button>
  )
}

// 元数据行组件
function MetadataRow({
  icon: Icon,
  label,
  value,
  copyable = false,
  isLink = false,
  onLinkClick
}: {
  icon: React.ElementType
  label: string
  value: string | null | undefined
  copyable?: boolean
  isLink?: boolean
  onLinkClick?: () => void
}) {
  if (!value) return null

  return (
    <div className="group flex items-start gap-2 py-1">
      <Icon className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
        {isLink ? (
          <button
            onClick={onLinkClick}
            className="text-xs leading-snug break-words text-primary hover:underline text-left"
          >
            {value}
          </button>
        ) : (
          <p className="text-xs leading-snug break-words">{value}</p>
        )}
      </div>
      {copyable && <CopyButton text={value} />}
    </div>
  )
}

// PDF 状态标签
function PdfBadge({ hasPdf }: { hasPdf: boolean }) {
  return (
    <Badge
      variant={hasPdf ? "default" : "secondary"}
      className={cn(
        "text-xs px-2 py-0.5",
        hasPdf ? "bg-green-600 hover:bg-green-600" : ""
      )}
    >
      {hasPdf ? "PDF" : "无 PDF"}
    </Badge>
  )
}

// 无 PDF 占位符
function NoPdfPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center h-full bg-muted/10">
      <FileX className="h-12 w-12 text-muted-foreground/30 mb-3" />
      <p className="text-sm font-medium text-muted-foreground">暂无 PDF 文件</p>
      <p className="text-xs text-muted-foreground/70 mt-1">该文献未关联 PDF 附件</p>
    </div>
  )
}

export function DocumentDetailDialog({ document, open, onOpenChange }: DocumentDetailDialogProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [showPdf, setShowPdf] = useState(false)

  // 当文档变化时更新 PDF URL
  useEffect(() => {
    if (document?.has_pdf && document?.id) {
      setPdfUrl(`http://localhost:8000/api/pdf/${document.id}`)
    } else {
      setPdfUrl(null)
    }
    // 每次打开新文档时重置 PDF 显示状态
    setShowPdf(false)
  }, [document])

  if (!document) return null

  const year = document.date?.substring(0, 4)
  const doiUrl = document.doi ? `https://doi.org/${document.doi}` : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex flex-col p-0 overflow-hidden gap-0 border shadow-2xl sm:rounded-xl transition-all duration-300 ease-in-out",
          showPdf
            ? "!max-w-[98vw] !w-[98vw] h-[95vh]"
            : "max-w-2xl w-full h-[85vh]"
        )}
        showCloseButton={false}
      >
        {/* 头部 */}
        <div className="shrink-0 flex items-center justify-between px-4 py-3 bg-muted/30 border-b">
          <div className="flex items-center gap-3 min-w-0 flex-1 pr-4">
            <PdfBadge hasPdf={document.has_pdf} />
            {year && (
              <Badge variant="outline" className="text-xs shrink-0">
                {year}
              </Badge>
            )}
            <DialogTitle className="text-base font-semibold leading-tight truncate">
              {document.title}
            </DialogTitle>
          </div>
          <div className="flex items-center gap-2">
            {document.has_pdf && (
              <Button
                size="sm"
                variant={showPdf ? "secondary" : "default"}
                onClick={() => setShowPdf(!showPdf)}
                className="h-8 text-xs gap-1.5"
              >
                {showPdf ? (
                  <>
                    <FileText className="h-3.5 w-3.5" />
                    隐藏 PDF
                  </>
                ) : (
                  <>
                    <Eye className="h-3.5 w-3.5" />
                    阅读 PDF
                  </>
                )}
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* 主体内容 */}
        <div className="flex-1 flex min-h-0">
          {/* 左侧：元数据和摘要 (始终显示) */}
          <div className={cn(
            "flex flex-col bg-background transition-all duration-300 min-h-0",
            showPdf ? "flex-[2] min-w-0 border-r max-w-md" : "flex-1 w-full"
          )}>
            <ScrollArea className="flex-1 h-full">
              <div className="p-5 space-y-5">
                {/* 快速操作栏 */}
                {doiUrl && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full text-xs h-9 shadow-sm"
                      onClick={() => window.open(doiUrl, '_blank')}
                    >
                      <ExternalLink className="h-3.5 w-3.5 mr-2" />
                      访问原文链接
                    </Button>
                  </div>
                )}

                {/* 基本信息 */}
                <section>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Users className="h-3.5 w-3.5" />
                    基本信息
                  </h3>
                  <div className="space-y-1 bg-muted/20 p-3 rounded-lg border border-border/50">
                    <MetadataRow
                      icon={Users}
                      label="作者"
                      value={document.authors}
                      copyable
                    />
                    <MetadataRow
                      icon={BookOpen}
                      label="期刊/会议"
                      value={document.publication}
                      copyable
                    />
                    <MetadataRow
                      icon={Calendar}
                      label="日期"
                      value={document.date}
                    />
                    <MetadataRow
                      icon={Globe}
                      label="DOI"
                      value={document.doi}
                      copyable
                      isLink
                      onLinkClick={() => doiUrl && window.open(doiUrl, '_blank')}
                    />
                  </div>
                </section>

                <Separator />

                {/* 摘要 */}
                <section>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5" />
                    摘要内容
                  </h3>
                  {document.abstract ? (
                    <div className="relative pl-4 border-l-2 border-primary/20">
                      <p className="text-sm leading-relaxed text-foreground/90 text-justify">
                        {document.abstract}
                      </p>
                    </div>
                  ) : (
                    <div className="py-8 text-center bg-muted/20 rounded-lg border border-dashed">
                      <p className="text-sm text-muted-foreground">该文献暂无摘要</p>
                    </div>
                  )}
                </section>

                {/* 标签 */}
                {document.tags.length > 0 && (
                  <>
                    <Separator />
                    <section>
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                        <Tag className="h-3.5 w-3.5" />
                        标签
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {document.tags.map((tag, i) => (
                          <Badge
                            key={i}
                            variant="secondary"
                            className="text-xs px-2.5 py-0.5 font-medium bg-muted/50 hover:bg-muted"
                          >
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </section>
                  </>
                )}

                <Separator />

                {/* 系统信息 */}
                <section>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-muted/10 p-2 rounded text-xs">
                      <span className="text-muted-foreground block mb-1">ID</span>
                      <span className="font-mono">{document.id}</span>
                    </div>
                    <div className="bg-muted/10 p-2 rounded text-xs">
                      <span className="text-muted-foreground block mb-1">扫描时间</span>
                      <span>{new Date(document.scanned_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </section>
              </div>
            </ScrollArea>
          </div>

          {/* 右侧：PDF 查看器 (点击展开) */}
          {showPdf && (
            <div className="flex-[3] min-w-0 bg-muted/10 border-l animate-in slide-in-from-right-10 duration-300 fade-in">
              {pdfUrl ? (
                <PdfViewer url={pdfUrl} className="h-full" />
              ) : (
                <NoPdfPlaceholder />
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
