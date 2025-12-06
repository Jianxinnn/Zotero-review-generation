"use client"

import { useState, useMemo, useEffect } from "react"
import { Search, ArrowUpDown, CheckSquare, Square, Loader2, User, BookOpen, Clock } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { DocumentDetailDialog } from "./document-detail-dialog"
import { cn } from "@/lib/utils"
import type { Document as ZoteroDocument } from "@/lib/types"
import { ScrollArea } from "@/components/ui/scroll-area"
import { format } from "date-fns"

interface DocumentListProps {
  documents: ZoteroDocument[]
  selectedIds: string[]
  onToggleDocument: (doc: ZoteroDocument) => void
  onSelectAll: (docs: ZoteroDocument[]) => void
  onDeselectAll: (docs: ZoteroDocument[]) => void
  isLoading: boolean
  onGlobalSearch?: (query: string) => void
  currentCollection?: string | null
  isSearchMode?: boolean
  lastSearchQuery?: string
}

type SortOption = "date" | "title" | "date_added"

export function DocumentList({
  documents,
  selectedIds,
  onToggleDocument,
  onSelectAll,
  onDeselectAll,
  isLoading,
  onGlobalSearch,
  currentCollection,
  isSearchMode,
  lastSearchQuery
}: DocumentListProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [globalSearchQuery, setGlobalSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState<SortOption>("date_added")
  const [detailDoc, setDetailDoc] = useState<ZoteroDocument | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [progress, setProgress] = useState(0)

  const filteredAndSortedDocs = useMemo(() => {
    let filtered = documents

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = documents.filter(
        (doc) =>
          doc.title.toLowerCase().includes(query) ||
          doc.authors.toLowerCase().includes(query) ||
          doc.abstract?.toLowerCase().includes(query),
      )
    }

    return filtered.sort((a, b) => {
      if (sortBy === "date") {
        return (b.date || "").localeCompare(a.date || "")
      }
      if (sortBy === "date_added") {
        return (b.date_added || "").localeCompare(a.date_added || "")
      }
      return a.title.localeCompare(b.title)
    })
  }, [documents, searchQuery, sortBy])

  const currentSelectedCount = filteredAndSortedDocs.filter(doc => selectedIds.includes(doc.id)).length
  const allCurrentSelected = currentSelectedCount === filteredAndSortedDocs.length && filteredAndSortedDocs.length > 0

  const handleToggleAll = () => {
    if (allCurrentSelected) {
      onDeselectAll(filteredAndSortedDocs)
    } else {
      onSelectAll(filteredAndSortedDocs)
    }
  }

  useEffect(() => {
    if (isLoading) {
      setProgress(0)
      const timer = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) return prev
          return prev + Math.random() * 15
        })
      }, 500)
      return () => clearInterval(timer)
    } else {
      setProgress(100)
      const timer = setTimeout(() => setProgress(0), 500)
      return () => clearTimeout(timer)
    }
  }, [isLoading])

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return ""
    try {
      return format(new Date(dateString), "yyyy-MM-dd HH:mm")
    } catch {
      return dateString
    }
  }

  const handleOpenDetail = (doc: ZoteroDocument) => {
    setDetailDoc(doc)
    setDetailOpen(true)
  }

  const handleGlobalSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (onGlobalSearch && globalSearchQuery.trim()) {
      onGlobalSearch(globalSearchQuery)
    }
  }

  // 如果没有集合且没有文档（且不在加载中），显示居中搜索页（支持显示无结果提示）
  if (!currentCollection && documents.length === 0 && !isLoading && onGlobalSearch) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-muted/5">
        <div className="w-full max-w-md space-y-4">
          <div className="space-y-2">
            <h3 className="text-2xl font-semibold tracking-tight">搜索 Zotero 文献</h3>
            <p className="text-sm text-muted-foreground">
              输入关键词搜索全部文献库
            </p>
          </div>
          <form onSubmit={handleGlobalSearchSubmit} className="flex gap-2">
            <Input 
              placeholder="输入关键词..." 
              value={globalSearchQuery}
              onChange={e => setGlobalSearchQuery(e.target.value)}
              className="flex-1"
            />
            <Button type="submit">
              <Search className="h-4 w-4 mr-2" />
              搜索
            </Button>
          </form>
          {isSearchMode && lastSearchQuery && (
            <div className="text-xs text-muted-foreground">
              未找到与 "{lastSearchQuery}" 相关的文献，试试其他关键词
            </div>
          )}
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 bg-background/50 backdrop-blur-sm">
        <div className="w-full max-w-xs space-y-6 text-center">
          <div className="relative mx-auto h-16 w-16">
            <div className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
            <div className="relative flex h-full w-full items-center justify-center rounded-full bg-primary/10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold tracking-tight">正在同步文献库</h3>
            <p className="text-sm text-muted-foreground">正在从 Zotero 获取元数据和 PDF 内容...</p>
          </div>
          <Progress value={progress} className="h-1.5 w-full overflow-hidden rounded-full bg-secondary" />
        </div>
      </div>
    )
  }

  if (documents.length === 0) {
    return (
      <div className="flex h-full items-center justify-center bg-muted/10">
        <div className="text-center max-w-sm px-6">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted shadow-inner">
            <BookOpen className="h-8 w-8 text-muted-foreground/50" />
          </div>
          <h3 className="mb-2 text-lg font-semibold text-foreground">准备就绪</h3>
          <p className="text-sm text-muted-foreground">
            请从左侧边栏选择一个集合并点击"开始扫描"以加载文献列表
          </p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="flex h-full flex-col bg-background overflow-hidden">
        {/* Toolbar */}
        <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-background/95 px-3 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/60 shrink-0">
          <div className="relative flex-1">
            {!currentCollection && onGlobalSearch ? (
               <form onSubmit={handleGlobalSearchSubmit} className="relative w-full">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="搜索全部文献..."
                    value={globalSearchQuery}
                    onChange={(e) => setGlobalSearchQuery(e.target.value)}
                    className="h-8 w-full bg-muted/50 pl-8 text-xs shadow-none focus-visible:bg-background focus-visible:ring-primary/20"
                  />
               </form>
            ) : (
               <>
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="筛选列表..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 w-full bg-muted/50 pl-8 text-xs shadow-none focus-visible:bg-background focus-visible:ring-primary/20"
                />
               </>
            )}
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-2 text-xs font-medium"
              onClick={() => {
                if (sortBy === "date_added") setSortBy("date")
                else if (sortBy === "date") setSortBy("title")
                else setSortBy("date_added")
              }}
            >
              <ArrowUpDown className="mr-1.5 h-3 w-3 text-muted-foreground" />
              {sortBy === "date_added" ? "添加时间" : sortBy === "date" ? "发表日期" : "标题"}
            </Button>

            <Button
              variant={allCurrentSelected ? "secondary" : "outline"}
              size="sm"
              className="h-8 px-2 text-xs font-medium"
              onClick={handleToggleAll}
            >
              {allCurrentSelected ? (
                <><CheckSquare className="mr-1.5 h-3 w-3 text-primary" /> 取消</>
              ) : (
                <><Square className="mr-1.5 h-3 w-3 text-muted-foreground" /> 全选</>
              )}
            </Button>
          </div>
        </div>

        {/* Document List - Compact */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <ScrollArea className="h-full w-full">
            <div className="flex flex-col w-full">
              {filteredAndSortedDocs.map((doc) => {
                const isSelected = selectedIds.includes(doc.id)
                return (
                  <div
                    key={doc.id}
                    className={cn(
                      "group grid grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-border/50 px-4 py-2 transition-all hover:bg-muted/50 cursor-pointer w-full",
                      isSelected && "bg-primary/5 hover:bg-primary/10"
                    )}
                    onClick={() => onToggleDocument(doc)}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => onToggleDocument(doc)}
                      className="h-4 w-4 border-muted-foreground/40 data-[state=checked]:border-primary data-[state=checked]:bg-primary"
                      onClick={(e) => e.stopPropagation()}
                    />

                    <div className="min-w-0 overflow-hidden">
                      <div className="flex items-center gap-2">
                        <h3 className={cn(
                          "truncate text-sm font-medium leading-none",
                          isSelected ? "text-primary" : "text-foreground"
                        )}>
                          {doc.title}
                        </h3>
                        {doc.has_pdf && (
                          <Badge variant="secondary" className="h-4 px-1 text-[9px] font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900 shrink-0">
                            PDF
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                        <div className="flex items-center gap-1 min-w-0">
                          <User className="h-3 w-3 opacity-70 shrink-0" />
                          <span className="truncate">{doc.authors || "未知作者"}</span>
                        </div>
                        {doc.date_added && (
                          <div className="flex items-center gap-1 shrink-0 text-muted-foreground/60">
                            <Clock className="h-3 w-3 opacity-70" />
                            <span>{formatDate(doc.date_added)}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 px-2.5 text-[10px] bg-background hover:bg-primary hover:text-primary-foreground border-border whitespace-nowrap"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleOpenDetail(doc)
                      }}
                    >
                      详情
                    </Button>
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        </div>

        {/* Footer Status */}
        <div className="shrink-0 border-t border-border bg-muted/20 px-4 py-1.5 text-[10px] text-muted-foreground flex justify-between items-center">
          <span>共 {filteredAndSortedDocs.length} 篇</span>
          <span className={cn("font-medium", currentSelectedCount > 0 ? "text-primary" : "")}>
            已选 {currentSelectedCount} 篇
          </span>
        </div>
      </div>

      <DocumentDetailDialog
        document={detailDoc}
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open)
          if (!open) setDetailDoc(null)
        }}
      />
    </>
  )
}
