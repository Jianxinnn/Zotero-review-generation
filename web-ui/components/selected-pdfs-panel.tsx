"use client"

import { useState } from "react"
import { X, FileText, Trash2, CheckCircle2, BookOpen, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { DocumentDetailDialog } from "./document-detail-dialog"
import type { Document } from "@/lib/types"

interface SelectedPdfsPanelProps {
  selectedDocuments: Document[]
  onRemove: (docId: string) => void
  onClearAll: () => void
}

export function SelectedPdfsPanel({ selectedDocuments, onRemove, onClearAll }: SelectedPdfsPanelProps) {
  const [detailDoc, setDetailDoc] = useState<Document | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const handleOpenDetail = (doc: Document) => {
    setDetailDoc(doc)
    setDetailOpen(true)
  }

  if (selectedDocuments.length === 0) {
    return (
      <div className="flex h-full flex-col bg-muted/10 border-t border-border/50">
        <div className="flex items-center justify-between px-4 py-2 border-b border-border/50 bg-background/50 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-muted-foreground/50" />
            <h3 className="text-xs font-medium text-muted-foreground">已选文献</h3>
          </div>
          <Badge variant="secondary" className="text-[10px] px-1.5 h-5 bg-muted text-muted-foreground">0</Badge>
        </div>
        <div className="flex flex-1 items-center justify-center p-4">
          <div className="flex flex-col items-center gap-2 text-muted-foreground/50">
            <div className="rounded-full bg-muted/50 p-3">
              <BookOpen className="h-5 w-5" />
            </div>
            <p className="text-xs font-medium">从上方列表勾选文献以进行分析</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="flex h-full flex-col bg-background/50 backdrop-blur-xl border-t border-border shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 border-b border-border/50 bg-background/80 shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary">
              <CheckCircle2 className="h-3.5 w-3.5" />
            </div>
            <h3 className="text-xs font-semibold text-foreground">已选文献</h3>
            <Badge variant="default" className="text-[10px] px-1.5 h-5 shadow-sm">{selectedDocuments.length}</Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[10px] text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            onClick={onClearAll}
          >
            <Trash2 className="h-3 w-3 mr-1.5" />
            清空列表
          </Button>
        </div>

        <div className="flex-1 min-h-0 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-3 flex flex-wrap gap-2">
              {selectedDocuments.map((doc) => (
                <div
                  key={doc.id}
                  className="group flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5 shadow-sm transition-all hover:border-primary/30 hover:shadow-md max-w-[300px]"
                >
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-primary/5 text-primary">
                    <FileText className="h-3.5 w-3.5" />
                  </div>

                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-[11px] font-medium truncate leading-tight">{doc.title}</span>
                    {doc.date && <span className="text-[9px] text-muted-foreground leading-tight">{doc.date.substring(0, 4)}</span>}
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-all hover:bg-primary/10 hover:text-primary shrink-0"
                    onClick={() => handleOpenDetail(doc)}
                    title="查看详情"
                  >
                    <Eye className="h-3 w-3" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-all hover:bg-destructive/10 hover:text-destructive shrink-0 -mr-1"
                    onClick={() => onRemove(doc.id)}
                    title="移除"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
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
