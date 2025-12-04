export type Collection = {
  key: string
  name: string
  num_items: number
  parent_key: string | null
}

export type Document = {
  id: string
  item_key: string
  title: string
  authors: string
  abstract?: string | null
  publication?: string | null
  date?: string | null
  doi?: string | null
  tags: string[]
  pdf_path?: string | null
  pdf_content?: string | null
  pdf_pages: number
  has_pdf: boolean
  pdf_loaded: boolean
  scanned_at: string
  date_added?: string | null
}

export type DocumentsResponse = {
  collection_name: string | null
  documents: Document[]
}

export type SearchResult = {
  doc_id: string
  title: string
  score: number
  content_snippet: string
  metadata: Record<string, any>
}

// 用于跨 Collection 选择的文档类型，包含来源集合信息
export type SelectedDocument = Document & {
  collectionName: string
}

// AI 聊天消息
export type ChatMessage = {
  role: "user" | "assistant"
  content: string
}

// AI 状态 - 用于持久化 AI 生成的结果
export type AIState = {
  // 总结结果
  summaryResult: { title: string; summary: string } | null
  summaryType: "full" | "quick" | "key_points"
  // 快速分类汇总结果
  categorizeResult: { title: string; summary: string } | null
  // 研究报告
  researchReport: string | null
  researchQuestion: string
  // 聊天历史
  chatMessages: ChatMessage[]
  // 搜索结果
  searchResults: SearchResult[]
  searchQuery: string
}
