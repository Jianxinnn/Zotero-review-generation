"use client"

import { useState } from "react"
import { FileText, MessageSquare, FlaskConical, Layers, Search, Sparkles } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import type { Document, AIState, ChatMessage, SearchResult } from "@/lib/types"
import { SummarizeTab } from "./ai-tabs/summarize-tab"
import { ChatTab } from "./ai-tabs/chat-tab"
import { ResearchTab } from "./ai-tabs/research-tab"
import { CategorizeTab } from "./ai-tabs/categorize-tab"
import { SearchTab } from "./ai-tabs/search-tab"

interface AIToolsPanelProps {
  selectedDocIds: string[]
  documents: Document[]
  aiState: AIState
  updateAIState: (updates: Partial<AIState>) => void
  isExpanded?: boolean
}

export function AIToolsPanel({
  selectedDocIds,
  documents,
  aiState,
  updateAIState,
  isExpanded = true
}: AIToolsPanelProps) {
  const [activeTab, setActiveTab] = useState("summarize")

  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-card/50 to-background/50 backdrop-blur-xl">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex h-full flex-col">
        {/* Header & Tabs */}
        <div className="shrink-0 border-b border-border/50 bg-background/40 px-4 pt-3 pb-0 backdrop-blur-md">
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500/20 to-purple-500/20 text-indigo-500 shadow-sm ring-1 ring-white/20">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold tracking-tight">AI 助手</h2>
              <p className="text-[10px] text-muted-foreground">智能文献分析与研究</p>
            </div>
          </div>

          <TabsList className="h-9 w-full justify-start gap-1 rounded-none border-b-0 bg-transparent p-0">
            <TabsTrigger
              value="summarize"
              className="relative h-9 rounded-t-lg border-b-2 border-transparent px-3 pb-2 pt-1.5 text-xs font-medium text-muted-foreground data-[state=active]:border-primary data-[state=active]:bg-background/50 data-[state=active]:text-foreground"
            >
              <FileText className="mr-1.5 h-3.5 w-3.5" />
              总结
            </TabsTrigger>
            <TabsTrigger
              value="chat"
              className="relative h-9 rounded-t-lg border-b-2 border-transparent px-3 pb-2 pt-1.5 text-xs font-medium text-muted-foreground data-[state=active]:border-primary data-[state=active]:bg-background/50 data-[state=active]:text-foreground"
            >
              <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
              对话
            </TabsTrigger>
            <TabsTrigger
              value="research"
              className="relative h-9 rounded-t-lg border-b-2 border-transparent px-3 pb-2 pt-1.5 text-xs font-medium text-muted-foreground data-[state=active]:border-primary data-[state=active]:bg-background/50 data-[state=active]:text-foreground"
            >
              <FlaskConical className="mr-1.5 h-3.5 w-3.5" />
              研究
            </TabsTrigger>
            <TabsTrigger
              value="categorize"
              className="relative h-9 rounded-t-lg border-b-2 border-transparent px-3 pb-2 pt-1.5 text-xs font-medium text-muted-foreground data-[state=active]:border-primary data-[state=active]:bg-background/50 data-[state=active]:text-foreground"
            >
              <Layers className="mr-1.5 h-3.5 w-3.5" />
              分类
            </TabsTrigger>
            <TabsTrigger
              value="search"
              className="relative h-9 rounded-t-lg border-b-2 border-transparent px-3 pb-2 pt-1.5 text-xs font-medium text-muted-foreground data-[state=active]:border-primary data-[state=active]:bg-background/50 data-[state=active]:text-foreground"
            >
              <Search className="mr-1.5 h-3.5 w-3.5" />
              搜索
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden bg-background/30">
          <TabsContent value="summarize" className="h-full m-0 data-[state=active]:flex flex-col">
            <SummarizeTab
              selectedDocIds={selectedDocIds}
              documents={documents}
              result={aiState.summaryResult}
              summaryType={aiState.summaryType}
              onUpdateResult={(result, type) => updateAIState({ summaryResult: result, summaryType: type })}
              isExpanded={isExpanded}
            />
          </TabsContent>

          <TabsContent value="chat" className="h-full m-0 data-[state=active]:flex flex-col">
            <ChatTab
              selectedDocIds={selectedDocIds}
              documents={documents}
              messages={aiState.chatMessages}
              onUpdateMessages={(messages) => updateAIState({ chatMessages: messages })}
              isExpanded={isExpanded}
            />
          </TabsContent>

          <TabsContent value="research" className="h-full m-0 data-[state=active]:flex flex-col">
            <ResearchTab
              selectedDocIds={selectedDocIds}
              documents={documents}
              report={aiState.researchReport}
              question={aiState.researchQuestion}
              onUpdateReport={(report, question) => updateAIState({ researchReport: report, researchQuestion: question })}
              isExpanded={isExpanded}
            />
          </TabsContent>

          <TabsContent value="categorize" className="h-full m-0 data-[state=active]:flex flex-col">
            <CategorizeTab
              selectedDocIds={selectedDocIds}
              documents={documents}
              result={aiState.categorizeResult}
              onUpdateResult={(result) => updateAIState({ categorizeResult: result })}
              isExpanded={isExpanded}
            />
          </TabsContent>

          <TabsContent value="search" className="h-full m-0 data-[state=active]:flex flex-col">
            <SearchTab
              selectedDocIds={selectedDocIds}
              documents={documents}
              searchResults={aiState.searchResults}
              searchQuery={aiState.searchQuery}
              onUpdateResults={(results, query) => updateAIState({ searchResults: results, searchQuery: query })}
              isExpanded={isExpanded}
            />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
