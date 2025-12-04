"use client"

import { 
  FileText, Calendar, BookOpen, Tag, ExternalLink, 
  File, Users, Hash, Copy, Check, X, Sparkles, 
  GraduationCap, Link2, ChevronRight, Globe, Clock
} from "lucide-react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import type { Document } from "@/lib/types"
import { useState } from "react"

interface DocumentDetailDialogProps {
  document: Document | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

// 复制按钮组件
function CopyButton({ text, size = "sm" }: { text: string; size?: "sm" | "xs" }) {
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
      className={cn(
        "shrink-0 hover:bg-primary/10",
        size === "sm" ? "h-7 w-7" : "h-5 w-5"
      )}
      onClick={handleCopy}
    >
      {copied ? (
        <Check className={cn("text-green-500", size === "sm" ? "h-3.5 w-3.5" : "h-3 w-3")} />
      ) : (
        <Copy className={cn("text-muted-foreground", size === "sm" ? "h-3.5 w-3.5" : "h-3 w-3")} />
      )}
    </Button>
  )
}

// 信息卡片组件
function InfoCard({ 
  icon: Icon, 
  label, 
  value, 
  copyable = false,
  link = false,
  accent = false
}: { 
  icon: React.ElementType
  label: string
  value: string | null | undefined
  copyable?: boolean
  link?: boolean
  accent?: boolean
}) {
  const displayValue = value || "-"
  const hasValue = !!value
  
  return (
    <div className={cn(
      "group flex items-center gap-3 p-3 rounded-xl transition-all duration-200",
      hasValue ? "hover:bg-muted/60" : "opacity-60",
      accent && hasValue && "bg-primary/5 hover:bg-primary/10"
    )}>
      <div className={cn(
        "flex items-center justify-center w-9 h-9 rounded-lg shrink-0 transition-colors",
        accent && hasValue 
          ? "bg-primary/15 text-primary" 
          : "bg-muted text-muted-foreground group-hover:bg-muted/80"
      )}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-0.5">
          {label}
        </p>
        <p className={cn(
          "text-sm leading-snug break-words",
          link && hasValue && "text-primary hover:underline cursor-pointer",
          !hasValue && "text-muted-foreground italic text-xs"
        )}>
          {displayValue}
        </p>
      </div>
      {copyable && hasValue && <CopyButton text={displayValue} />}
      {link && hasValue && (
        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      )}
    </div>
  )
}

// PDF 状态指示器
function PdfStatusIndicator({ hasPdf, pdfLoaded }: { hasPdf: boolean; pdfLoaded: boolean }) {
  return (
    <div className={cn(
      "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium",
      hasPdf 
        ? "bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20"
        : "bg-muted text-muted-foreground border border-border"
    )}>
      <div className={cn(
        "w-2 h-2 rounded-full",
        hasPdf ? "bg-green-500" : "bg-muted-foreground"
      )} />
      {hasPdf ? "有 PDF" : "无 PDF"}
    </div>
  )
}

export function DocumentDetailDialog({ document, open, onOpenChange }: DocumentDetailDialogProps) {
  const [activeSection, setActiveSection] = useState<"abstract" | "info">("abstract")
  
  if (!document) return null

  const year = document.date?.substring(0, 4)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-[98vw] w-[98vw] h-[95vh] flex flex-col p-0 overflow-hidden gap-0 border-0 shadow-2xl sm:rounded-xl"
        showCloseButton={false}
      >
        {/* Hero Header - 渐变背景 */}
        <div className="relative shrink-0 bg-gradient-to-br from-background via-muted/30 to-muted/50 border-b">
          {/* 关闭按钮 */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-6 top-6 h-9 w-9 rounded-full hover:bg-muted/80 z-10 transition-transform hover:scale-105"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-5 w-5" />
          </Button>
          
          <div className="px-12 pt-8 pb-6">
            {/* 顶部快速信息 */}
            <div className="flex items-center gap-3 mb-5">
              <PdfStatusIndicator 
                hasPdf={document.has_pdf} 
                pdfLoaded={document.pdf_loaded} 
              />
              {year && (
                <Badge variant="secondary" className="px-3 py-1 text-sm font-medium bg-background/50 border shadow-sm">
                  <Calendar className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                  {year}
                </Badge>
              )}
              {document.tags.length > 0 && (
                <Badge variant="outline" className="px-3 py-1 text-sm font-normal bg-background/50">
                  <Tag className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                  {document.tags.length} 标签
                </Badge>
              )}
            </div>
            
            {/* 标题 */}
            <DialogTitle className="text-2xl md:text-3xl font-bold leading-tight tracking-tight mb-5 pr-16 text-foreground/90">
              {document.title}
            </DialogTitle>
            
            {/* 作者 & 期刊信息 */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-base text-muted-foreground">
              <div className="flex items-center gap-2.5">
                <Users className="h-4.5 w-4.5 shrink-0 text-primary/60" />
                <span className="font-medium text-foreground/80">{document.authors || "未知作者"}</span>
              </div>
              {document.publication && (
                <>
                  <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />
                  <div className="flex items-center gap-2.5">
                    <BookOpen className="h-4.5 w-4.5 shrink-0 text-primary/60" />
                    <span className="italic text-foreground/70">{document.publication}</span>
                  </div>
                </>
              )}
            </div>
          </div>
          
          {/* 切换标签 */}
          <div className="px-12 flex gap-8 border-b border-transparent">
            <button
              onClick={() => setActiveSection("abstract")}
              className={cn(
                "pb-3 text-base font-medium transition-all border-b-2 -mb-[1px] hover:text-primary/80",
                activeSection === "abstract" 
                  ? "text-primary border-primary" 
                  : "text-muted-foreground border-transparent hover:border-border"
              )}
            >
              <span className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                摘要内容
              </span>
            </button>
            <button
              onClick={() => setActiveSection("info")}
              className={cn(
                "pb-3 text-base font-medium transition-all border-b-2 -mb-[1px] hover:text-primary/80",
                activeSection === "info" 
                  ? "text-primary border-primary" 
                  : "text-muted-foreground border-transparent hover:border-border"
              )}
            >
              <span className="flex items-center gap-2">
                <GraduationCap className="h-4 w-4" />
                详细元数据
              </span>
            </button>
          </div>
        </div>

        {/* 内容区域 */}
        <div className="flex-1 bg-background overflow-hidden min-h-0">
          <ScrollArea className="h-full w-full">
            {activeSection === "abstract" ? (
              // 摘要视图
              <div className="p-12 max-w-6xl mx-auto">
                {document.abstract ? (
                  <div className="space-y-8">
                    <div className="relative pl-6 border-l-3 border-primary/20 hover:border-primary/30 transition-colors">
                      <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4 select-none">Abstract</h3>
                      <p className="text-base md:text-lg leading-relaxed text-foreground/90 text-justify">
                        {document.abstract}
                      </p>
                    </div>
                    
                    {/* 标签云 */}
                    {document.tags.length > 0 && (
                      <div className="pt-8 border-t">
                        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2 select-none">
                          <Tag className="h-3.5 w-3.5" />
                          Keywords & Tags
                        </h3>
                        <div className="flex flex-wrap gap-2.5">
                          {document.tags.map((tag, i) => (
                            <Badge 
                              key={i} 
                              variant="secondary" 
                              className="px-3 py-1.5 text-sm font-normal bg-muted/40 hover:bg-primary/10 hover:text-primary transition-all cursor-default border-transparent hover:border-primary/20 border"
                            >
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-24 text-center opacity-60">
                    <FileText className="h-14 w-14 text-muted-foreground mb-5" />
                    <p className="text-lg font-medium text-foreground">暂无摘要</p>
                    <p className="text-sm text-muted-foreground mt-2">该文献未包含摘要内容</p>
                  </div>
                )}
              </div>
            ) : (
              // 详细信息视图
              <div className="p-12 max-w-6xl mx-auto space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <InfoCard 
                    icon={Users} 
                    label="作者" 
                    value={document.authors} 
                    copyable 
                  />
                  <InfoCard 
                    icon={Calendar} 
                    label="发表日期" 
                    value={document.date} 
                  />
                  <InfoCard 
                    icon={BookOpen} 
                    label="期刊 / 会议" 
                    value={document.publication} 
                    copyable 
                    accent
                  />
                  <InfoCard 
                    icon={Globe} 
                    label="DOI" 
                    value={document.doi} 
                    copyable 
                    link
                  />
                  <InfoCard 
                    icon={Hash} 
                    label="文档 ID" 
                    value={document.id} 
                    copyable 
                  />
                  <InfoCard 
                    icon={File} 
                    label="PDF 状态" 
                    value={document.has_pdf ? "有 PDF 文件" : "无 PDF 文件"} 
                  />
                </div>
                
                {/* 标签区域 */}
                {document.tags.length > 0 && (
                  <div className="pt-6 mt-6 border-t">
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2 select-none">
                      <Tag className="h-3.5 w-3.5" />
                      All Tags
                    </h3>
                    <div className="flex flex-wrap gap-2.5">
                      {document.tags.map((tag, i) => (
                        <Badge 
                          key={i} 
                          variant="outline" 
                          className="px-3 py-1.5 text-sm font-normal hover:bg-muted/50 transition-colors cursor-default"
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </div>
        
        {/* 底部操作栏 */}
        <div className="shrink-0 flex items-center justify-between px-12 py-4 bg-muted/20 border-t backdrop-blur-sm">
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <Clock className="h-4 w-4" />
            扫描于 {new Date(document.scanned_at).toLocaleString('zh-CN')}
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="px-5">
              关闭
            </Button>
            {document.doi && (
              <Button 
                className="gap-2 shadow-sm px-5"
                onClick={() => window.open(`https://doi.org/${document.doi}`, '_blank')}
              >
                <Link2 className="h-4 w-4" />
                访问原文
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
