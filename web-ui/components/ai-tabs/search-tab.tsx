"use client"

import { useState } from "react"
import { Search as SearchIcon, Loader2, FileSearch, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { apiPost } from "@/lib/api"
import type { Document, SearchResult } from "@/lib/types"

interface SearchTabProps {
  selectedDocIds: string[]
  documents: Document[]
  searchResults: SearchResult[]
  searchQuery: string
  onUpdateResults: (results: SearchResult[], query: string) => void
  isExpanded?: boolean
}

export function SearchTab({ selectedDocIds, searchResults, searchQuery, onUpdateResults, isExpanded = false }: SearchTabProps) {
  const [localQuery, setLocalQuery] = useState(searchQuery)
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()
  
  const hasSearched = searchResults.length > 0 || searchQuery.trim() !== ""

  const handleSearch = async () => {
    if (!localQuery.trim()) {
      toast({
        title: "提示",
        description: "请输入搜索内容",
      })
      return
    }

    setIsLoading(true)
        try {
      const data = await apiPost<SearchResult[], { query: string; n_results?: number }>(
        "/api/search",
        {
          query: localQuery.trim(),
          n_results: 20,
        },
      )
      onUpdateResults(data, localQuery.trim())
    } catch (error) {
      toast({
        title: "错误",
        description:
          error instanceof Error ? `搜索失败：${error.message}` : "搜索失败，请重试",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const clearSearch = () => {
    setLocalQuery("")
    onUpdateResults([], "")
  }

  return (
    <div className="flex h-full flex-col">
      {/* Search Header */}
      <div className="border-b px-4 py-3 space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="语义搜索，例如：transformer 优化方法"
              value={localQuery}
              onChange={(e) => setLocalQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  handleSearch()
                }
              }}
              className="pl-9 pr-8 h-9 text-sm"
            />
            {localQuery && (
              <button
                onClick={clearSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Button onClick={handleSearch} disabled={isLoading} size="sm" className="h-9">
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "搜索"
            )}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground">
          搜索范围：当前已扫描集合 · Enter 快捷搜索
        </p>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {!hasSearched ? (
          <div className="flex h-full flex-col items-center justify-center text-center p-4">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <FileSearch className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">输入关键词进行语义搜索</p>
            <p className="mt-1 text-xs text-muted-foreground">
              在文献全文内容中智能检索
            </p>
          </div>
        ) : searchResults.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center p-4">
            <p className="text-sm text-muted-foreground">未找到相关结果</p>
            <p className="mt-1 text-xs text-muted-foreground">尝试使用不同的关键词</p>
          </div>
        ) : (
          <div className="p-3 space-y-2">
            <p className="text-xs text-muted-foreground mb-2">
              找到 <span className="font-medium text-foreground">{searchResults.length}</span> 条结果
            </p>
            {searchResults.map((result, idx) => (
              <div
                key={`${result.doc_id}-${result.metadata?.chunk_index ?? idx}`}
                className="rounded-lg border bg-card p-3 text-sm hover:border-primary/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="font-medium leading-snug text-sm line-clamp-2">{result.title}</p>
                  <Badge 
                    variant="secondary" 
                    className={cn(
                      "text-[10px] shrink-0",
                      result.score > 0.8 && "bg-green-500/10 text-green-600",
                      result.score > 0.6 && result.score <= 0.8 && "bg-yellow-500/10 text-yellow-600",
                      result.score <= 0.6 && "bg-muted text-muted-foreground"
                    )}
                  >
                    {(result.score * 100).toFixed(0)}%
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                  {result.content_snippet}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

