"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { Search, Loader2, AlertCircle, RefreshCw, FolderOpen, Folder, Scan, ListTree, LayoutList, ChevronRight, ChevronDown, StopCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import type { Collection, Document } from "@/lib/types"
import { apiGet, apiPost, cancelRequest } from "@/lib/api"
import { ScrollArea } from "@/components/ui/scroll-area"

// 请求标识
const COLLECTIONS_REQUEST_KEY = 'fetch_collections'
const SCAN_REQUEST_KEY = 'scan_collection'

interface CollectionSidebarProps {
  onScanComplete: (docs: Document[], collectionName: string) => void
  isLoading: boolean
  setIsLoading: (loading: boolean) => void
}

interface CollectionNode extends Collection {
  children: CollectionNode[]
}

function buildCollectionTree(collections: Collection[]): CollectionNode[] {
  const nodeMap = new Map<string, CollectionNode>()
  const rootNodes: CollectionNode[] = []

  // Initialize nodes
  collections.forEach(c => {
    nodeMap.set(c.key, { ...c, children: [] })
  })

  // Build tree
  collections.forEach(c => {
    const node = nodeMap.get(c.key)!
    if (c.parent_key && nodeMap.has(c.parent_key)) {
      const parent = nodeMap.get(c.parent_key)!
      parent.children.push(node)
    } else {
      rootNodes.push(node)
    }
  })

  // Sort nodes by name
  const sortNodes = (nodes: CollectionNode[]) => {
    nodes.sort((a, b) => a.name.localeCompare(b.name))
    nodes.forEach(n => sortNodes(n.children))
  }
  sortNodes(rootNodes)

  return rootNodes
}

export function CollectionSidebar({ onScanComplete, isLoading, setIsLoading }: CollectionSidebarProps) {
  const [collections, setCollections] = useState<Collection[]>([])
  const [filteredCollections, setFilteredCollections] = useState<Collection[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null)
  const [loadPdf, setLoadPdf] = useState(false)
  const [isLoadingCollections, setIsLoadingCollections] = useState(true)
  const [viewMode, setViewMode] = useState<"list" | "tree">("tree")
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
  const { toast } = useToast()

  useEffect(() => {
    fetchCollections()
  }, [])

  useEffect(() => {
    if (searchQuery) {
      const filtered = collections.filter((c) => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
      setFilteredCollections(filtered)
      // Search mode forces list view or flat list
    } else {
      setFilteredCollections(collections)
    }
  }, [searchQuery, collections])

  const collectionTree = useMemo(() => {
    if (searchQuery) return [] // In search mode, we rely on filteredCollections (flat)
    return buildCollectionTree(collections)
  }, [collections, searchQuery])

  const toggleExpand = (key: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setExpandedNodes(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // 组件卸载时取消请求
  useEffect(() => {
    return () => {
      cancelRequest(COLLECTIONS_REQUEST_KEY)
      cancelRequest(SCAN_REQUEST_KEY)
    }
  }, [])

  const fetchCollections = useCallback(async () => {
    setIsLoadingCollections(true)
    try {
      const data = await apiGet<Collection[]>("/api/collections", { key: COLLECTIONS_REQUEST_KEY })
      setCollections(data)
      setFilteredCollections(data)
    } catch (error) {
      // 忽略取消错误
      if (error instanceof Error && error.name === 'AbortError') return
      
      toast({
        title: "错误",
        description:
          error instanceof Error ? `无法加载集合列表：${error.message}` : "无法加载集合列表",
        variant: "destructive",
      })
    } finally {
      setIsLoadingCollections(false)
    }
  }, [toast])

  const handleCancelScan = useCallback(() => {
    cancelRequest(SCAN_REQUEST_KEY)
    setIsLoading(false)
    toast({
      title: "已取消",
      description: "扫描已取消",
    })
  }, [toast, setIsLoading])

  const handleScan = useCallback(async (targetCollection?: Collection) => {
    const collectionToScan = targetCollection || selectedCollection
    if (!collectionToScan) {
      toast({
        title: "提示",
        description: "请先选择一个集合",
      })
      return
    }

    setIsLoading(true)
    try {
      const documents = await apiPost<Document[], { collection_name: string; load_pdf: boolean }>(
        "/api/scan",
        {
          collection_name: collectionToScan.name,
          load_pdf: loadPdf,
        },
        { key: SCAN_REQUEST_KEY }
      )

      onScanComplete(documents, collectionToScan.name)

      toast({
        title: "扫描完成",
        description: `成功扫描 ${documents.length} 篇文献`,
      })
    } catch (error) {
      // 忽略取消错误
      if (error instanceof Error && error.name === 'AbortError') return
      
      toast({
        title: "错误",
        description:
          error instanceof Error ? `扫描失败：${error.message}` : "扫描失败，请检查后端连接",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }, [selectedCollection, loadPdf, toast, setIsLoading, onScanComplete])

  const renderTree = (nodes: CollectionNode[], level = 0) => {
    return nodes.map(node => {
      const hasChildren = node.children.length > 0
      const isExpanded = expandedNodes.has(node.key)
      const isActive = selectedCollection?.key === node.key

      return (
        <div key={node.key}>
          <button
            onClick={() => setSelectedCollection(node)}
            onDoubleClick={() => {
              setSelectedCollection(node)
              handleScan(node)
            }}
            className={cn(
              "group flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs transition-all duration-200 hover:bg-muted/50",
              isActive && "bg-primary/10 text-primary font-medium"
            )}
            style={{ paddingLeft: `${level * 12 + 8}px` }}
          >
            <div className="flex items-center gap-1.5 overflow-hidden">
              {hasChildren ? (
                <div
                  className="h-4 w-4 flex items-center justify-center hover:bg-muted/80 rounded cursor-pointer transition-colors"
                  onClick={(e) => toggleExpand(node.key, e)}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-3 w-3 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-3 w-3 text-muted-foreground" />
                  )}
                </div>
              ) : (
                <div className="w-4" /> // Spacer
              )}
              
              <Folder className={cn(
                "h-3.5 w-3.5 shrink-0 transition-colors",
                isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
              )} />
              <span className="truncate">{node.name}</span>
            </div>
            <span className={cn(
              "ml-2 rounded-full px-1.5 py-0.5 text-[9px] transition-colors",
              isActive
                ? "bg-primary/20 text-primary"
                : "bg-muted text-muted-foreground group-hover:bg-background"
            )}>
              {node.num_items}
            </span>
          </button>
          {hasChildren && isExpanded && (
            <div className="border-l border-border/40 ml-[15px]">
              {renderTree(node.children, level + 1)}
            </div>
          )}
        </div>
      )
    })
  }

  return (
    <div className="flex h-full w-full flex-col bg-sidebar/50 backdrop-blur-xl">
      <div className="flex flex-col gap-3 p-3 pb-2 shrink-0">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FolderOpen className="h-3.5 w-3.5" />
            </div>
            <h2 className="text-sm font-semibold tracking-tight">文献集合</h2>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              onClick={() => setViewMode(prev => prev === "list" ? "tree" : "list")}
              title={viewMode === "list" ? "切换到树形视图" : "切换到列表视图"}
            >
              {viewMode === "list" ? <ListTree className="h-3.5 w-3.5" /> : <LayoutList className="h-3.5 w-3.5" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              onClick={fetchCollections}
              disabled={isLoadingCollections}
              title="刷新"
            >
              <RefreshCw className={cn("h-3 w-3", isLoadingCollections && "animate-spin")} />
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜索集合..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 bg-background/50 pl-8 text-xs shadow-sm focus-visible:ring-primary/20"
          />
        </div>
      </div>

      {/* Collections List */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full px-2">
          <div className="space-y-0.5 py-1">
            {isLoadingCollections ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Loader2 className="mb-2 h-6 w-6 animate-spin text-primary/50" />
                <p className="text-[10px] text-muted-foreground">正在同步 Zotero...</p>
              </div>
            ) : filteredCollections.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                  <AlertCircle className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-[10px] font-medium text-muted-foreground">
                  {collections.length === 0 ? "暂无集合" : "未找到匹配项"}
                </p>
                {collections.length === 0 && (
                  <Button
                    variant="link"
                    size="sm"
                    className="mt-1 h-auto p-0 text-[10px] text-primary"
                    onClick={fetchCollections}
                  >
                    重新加载
                  </Button>
                )}
              </div>
            ) : (
              // Render based on viewMode and search state
              (!searchQuery && viewMode === "tree") ? (
                renderTree(collectionTree)
              ) : (
                filteredCollections.map((collection) => {
                  const isActive = selectedCollection?.key === collection.key
                  return (
                    <button
                      key={collection.key}
                      onClick={() => setSelectedCollection(collection)}
                      onDoubleClick={() => {
                        setSelectedCollection(collection)
                        handleScan(collection)
                      }}
                      className={cn(
                        "group flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-xs transition-all duration-200",
                        isActive
                          ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <Folder className={cn(
                          "h-3.5 w-3.5 shrink-0 transition-colors",
                          isActive ? "text-primary-foreground/90" : "text-muted-foreground group-hover:text-primary"
                        )} />
                        <span className="truncate font-medium">{collection.name}</span>
                      </div>
                      <span className={cn(
                        "ml-2 rounded-full px-1.5 py-0.5 text-[9px] font-medium transition-colors",
                        isActive
                          ? "bg-primary-foreground/20 text-primary-foreground"
                          : "bg-muted text-muted-foreground group-hover:bg-background"
                      )}>
                        {collection.num_items}
                      </span>
                    </button>
                  )
                })
              )
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Footer Actions */}
      <div className="shrink-0 border-t border-border bg-card/50 p-3 backdrop-blur-sm">
        <div className="mb-3 flex items-center justify-between">
          <Label htmlFor="load-pdf" className="text-[10px] font-medium text-muted-foreground">
            包含 PDF 内容
          </Label>
          <Switch
            id="load-pdf"
            checked={loadPdf}
            onCheckedChange={setLoadPdf}
            className="scale-75 data-[state=checked]:bg-primary"
          />
        </div>

        {isLoading ? (
          <Button
            onClick={handleCancelScan}
            variant="destructive"
            className="w-full shadow-lg transition-all duration-300 h-8 text-xs"
            size="sm"
          >
            <StopCircle className="mr-1.5 h-3 w-3" />
            取消扫描
          </Button>
        ) : (
          <Button
            onClick={() => handleScan()}
            disabled={!selectedCollection}
            className={cn(
              "w-full shadow-lg transition-all duration-300 h-8 text-xs",
              "hover:shadow-primary/25"
            )}
            size="sm"
          >
            <Scan className="mr-1.5 h-3 w-3" />
            开始扫描
          </Button>
        )}

        {!isLoadingCollections && collections.length > 0 && (
          <p className="mt-2 text-center text-[9px] text-muted-foreground/60">
            已加载 {collections.length} 个集合
          </p>
        )}
      </div>
    </div>
  )
}
