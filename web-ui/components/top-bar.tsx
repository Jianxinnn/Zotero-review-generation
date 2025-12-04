"use client"

import { BookOpen } from "lucide-react"
import { API_BASE } from "@/lib/api"

interface TopBarProps {
  currentCollection: string | null
  documentCount: number
}

export function TopBar({ currentCollection, documentCount }: TopBarProps) {
  return (
    <div className="flex items-center justify-between border-b border-border bg-card px-6 py-4">
      <div className="flex items-center gap-3">
        <BookOpen className="h-6 w-6 text-primary" />
        <h1 className="text-xl font-semibold">Zotero 文献助手</h1>
      </div>

      <div className="flex items-center gap-6 text-sm">
        <div className="text-muted-foreground">
          API: <span className="text-foreground">{API_BASE}</span>
        </div>

        <div className="text-muted-foreground">
          {currentCollection ? (
            <>
              集合: <span className="text-foreground">{currentCollection}</span>
              {" · "}
              <span className="text-foreground">{documentCount}</span> 篇文献
            </>
          ) : (
            "未加载集合"
          )}
        </div>
      </div>
    </div>
  )
}
