"use client"

import { useEffect, useState, useCallback } from "react"
import { Maximize2, Minimize2, PanelRightClose, PanelRightOpen, BookOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CollectionSidebar } from "./collection-sidebar"
import { DocumentList } from "./document-list"
import { AIToolsPanel } from "./ai-tools-panel"
import { SelectedPdfsPanel } from "./selected-pdfs-panel"
import type { Document, DocumentsResponse, AIState, ChatMessage, SearchResult } from "@/lib/types"
import { apiGet, searchDocuments } from "@/lib/api"
import { cn } from "@/lib/utils"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"

// 初始 AI 状态
const initialAIState: AIState = {
  summaryResult: null,
  summaryType: "full",
  categorizeResult: null,
  researchReport: null,
  researchQuestion: "",
  chatMessages: [],
  searchResults: [],
  searchQuery: "",
}

export function ZoteroAssistant() {
  // 当前集合的文档
  const [documents, setDocuments] = useState<Document[]>([])
  // 当前集合名称
  const [currentCollection, setCurrentCollection] = useState<string | null>(null)
  // 全局已选文档（支持跨 Collection），使用 Map 保证唯一性
  const [selectedDocuments, setSelectedDocuments] = useState<Map<string, Document & { collectionName: string }>>(new Map())
  const [isScanLoading, setIsScanLoading] = useState(false)

  // AI 面板展开状态 (controlled by resizable panel now, but we keep state for button toggle if needed)
  const [isAIPanelCollapsed, setIsAIPanelCollapsed] = useState(false)

  // AI 状态 - 持久化存储 AI 生成结果
  const [aiState, setAIState] = useState<AIState>(initialAIState)

  // 搜索模式状态
  const [isSearchMode, setIsSearchMode] = useState(false)
  const [lastSearchQuery, setLastSearchQuery] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 50

  // AI 状态更新函数
  const updateAIState = useCallback((updates: Partial<AIState>) => {
    setAIState(prev => ({ ...prev, ...updates }))
  }, [])

  // 获取已选文档 ID 列表
  const selectedDocIds = Array.from(selectedDocuments.keys())
  // 获取已选文档数组
  const selectedDocsArray = Array.from(selectedDocuments.values())

  // 页面加载时尝试从后端恢复当前文献列表
  useEffect(() => {
    const restoreDocuments = async () => {
      try {
        const data = await apiGet<DocumentsResponse>("/api/documents")
        if (data.documents && data.documents.length > 0) {
          setDocuments(data.documents)
          setCurrentCollection(data.collection_name)
        }
      } catch {
        // 后端未启动或接口异常时静默忽略
      }
    }
    restoreDocuments()
  }, [])

  const handleScanComplete = (docs: Document[], collectionName: string) => {
    setDocuments(docs)
    setCurrentCollection(collectionName)
    setIsSearchMode(false)
    setLastSearchQuery("")
    setCurrentPage(1)
  }

  // 处理单个文档选择/取消选择
  const handleToggleDocument = useCallback((doc: Document) => {
    setSelectedDocuments(prev => {
      const newMap = new Map(prev)
      if (newMap.has(doc.id)) {
        newMap.delete(doc.id)
      } else {
        newMap.set(doc.id, { ...doc, collectionName: currentCollection || "" })
      }
      return newMap
    })
  }, [currentCollection])

  // 处理选择当前列表所有文档
  const handleSelectAll = useCallback((docs: Document[]) => {
    setSelectedDocuments(prev => {
      const newMap = new Map(prev)
      docs.forEach(doc => {
        if (!newMap.has(doc.id)) {
          newMap.set(doc.id, { ...doc, collectionName: currentCollection || "" })
        }
      })
      return newMap
    })
  }, [currentCollection])

  // 处理取消选择当前列表所有文档
  const handleDeselectAll = useCallback((docs: Document[]) => {
    setSelectedDocuments(prev => {
      const newMap = new Map(prev)
      docs.forEach(doc => {
        newMap.delete(doc.id)
      })
      return newMap
    })
  }, [])

  const handleGlobalSearch = async (query: string) => {
    setIsScanLoading(true)
    setIsSearchMode(true)
    setLastSearchQuery(query)
    setCurrentPage(1)
    try {
      const data = await searchDocuments(query)
      setDocuments(data.documents)
      setCurrentCollection(null) // Clear collection to indicate search mode
    } catch (error) {
      console.error("Search failed", error)
    } finally {
      setIsScanLoading(false)
    }
  }

  // 移除单个已选文档
  const handleRemoveDocument = useCallback((docId: string) => {
    setSelectedDocuments(prev => {
      const newMap = new Map(prev)
      newMap.delete(docId)
      return newMap
    })
  }, [])

  // 清空所有已选文档
  const handleClearAll = useCallback(() => {
    setSelectedDocuments(new Map())
  }, [])

  // 清除当前 collection
  const handleClearCollection = useCallback(() => {
    setDocuments([])
    setCurrentCollection(null)
    setIsSearchMode(false)
    setLastSearchQuery("")
    setCurrentPage(1)
  }, [])

  const totalPages = Math.max(1, Math.ceil(documents.length / pageSize))
  const pagedDocuments = documents.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  return (
    <div className="h-screen w-full bg-background overflow-hidden font-sans">
      <ResizablePanelGroup direction="horizontal" className="h-full w-full rounded-lg border">
        {/* Left Sidebar - Collections */}
        <ResizablePanel defaultSize={18} minSize={15} maxSize={25} className="bg-sidebar/50 backdrop-blur-xl">
          <CollectionSidebar
            onScanComplete={handleScanComplete}
            isLoading={isScanLoading}
            setIsLoading={setIsScanLoading}
          />
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Center - Collection Documents (top) + Selected PDFs (bottom) */}
        <ResizablePanel defaultSize={52} minSize={30} className="relative z-10">
          <ResizablePanelGroup direction="vertical">
            {/* Top: Document List */}
            <ResizablePanel defaultSize={75} minSize={30} className="bg-muted/5 relative overflow-hidden">
              <div className="flex flex-col h-full overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-border bg-background/80 backdrop-blur-sm px-4 py-2 shrink-0">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <BookOpen className="h-4 w-4" />
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold text-foreground leading-tight">
                        {currentCollection || (isSearchMode ? `搜索: ${lastSearchQuery}` : "文献列表")}
                      </h2>
                      {documents.length > 0 && (
                        <p className="text-[10px] text-muted-foreground font-medium leading-tight">
                          共 {documents.length} 篇文献
                        </p>
                      )}
                    </div>
                  </div>
                  {(currentCollection || isSearchMode) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleClearCollection}
                      className="h-7 text-xs"
                    >
                      <PanelRightClose className="h-3.5 w-3.5 mr-1" />
                      {isSearchMode ? "退出搜索" : "退出集合"}
                    </Button>
                  )}
                </div>

                {/* Document List */}
                <div className="flex-1 overflow-hidden">
                  <DocumentList
                    documents={documents}
                    selectedIds={selectedDocIds}
                    onToggleDocument={handleToggleDocument}
                    onSelectAll={handleSelectAll}
                    onDeselectAll={handleDeselectAll}
                    isLoading={isScanLoading}
                    onGlobalSearch={handleGlobalSearch}
                    page={currentPage}
                    pageSize={pageSize}
                    total={documents.length}
                    onPageChange={setCurrentPage}
                    currentCollection={currentCollection}
                    isSearchMode={isSearchMode}
                    lastSearchQuery={lastSearchQuery}
                  />
                </div>
              </div>
            </ResizablePanel>

            <ResizableHandle withHandle />

            {/* Bottom: Selected PDFs Panel */}
            <ResizablePanel defaultSize={25} minSize={15} maxSize={40}>
              <SelectedPdfsPanel
                selectedDocuments={selectedDocsArray}
                onRemove={handleRemoveDocument}
                onClearAll={handleClearAll}
              />
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Right Panel - AI Tools */}
        <ResizablePanel
          defaultSize={30}
          minSize={20}
          maxSize={50}
          collapsible={true}
          collapsedSize={0}
          onCollapse={() => setIsAIPanelCollapsed(true)}
          onExpand={() => setIsAIPanelCollapsed(false)}
          className={cn("bg-card transition-all duration-300 ease-in-out", isAIPanelCollapsed && "min-w-[0px]")}
        >
          <div className="h-full relative">
            <AIToolsPanel
              selectedDocIds={selectedDocIds}
              documents={selectedDocsArray}
              aiState={aiState}
              updateAIState={updateAIState}
              isExpanded={!isAIPanelCollapsed}
            />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
