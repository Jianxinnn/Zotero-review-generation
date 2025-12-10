"use client"

import { useState, useCallback, useEffect } from "react"
import { Document, Page, pdfjs } from "react-pdf"
import {
    ZoomIn, ZoomOut, Loader2, FileWarning, RotateCw
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// 设置 PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

interface PdfViewerProps {
    url: string
    className?: string
}

export function PdfViewer({ url, className }: PdfViewerProps) {
    const [numPages, setNumPages] = useState<number>(0)
    const [scale, setScale] = useState<number>(1.0)
    const [loading, setLoading] = useState<boolean>(true)
    const [error, setError] = useState<string | null>(null)
    const [containerWidth, setContainerWidth] = useState<number>(600)

    // 监测容器宽度
    useEffect(() => {
        const updateWidth = () => {
            const container = document.getElementById('pdf-scroll-container')
            if (container) {
                setContainerWidth(container.clientWidth - 48) // 减去 padding
            }
        }
        updateWidth()
        window.addEventListener('resize', updateWidth)
        return () => window.removeEventListener('resize', updateWidth)
    }, [])

    const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
        setNumPages(numPages)
        setLoading(false)
        setError(null)
    }, [])

    const onDocumentLoadError = useCallback((err: Error) => {
        console.error("PDF 加载失败:", err)
        setError("无法加载 PDF 文件")
        setLoading(false)
    }, [])

    const zoomIn = () => setScale(s => Math.min(2.5, s + 0.25))
    const zoomOut = () => setScale(s => Math.max(0.5, s - 0.25))
    const resetZoom = () => setScale(1.0)

    if (error) {
        return (
            <div className={cn(
                "flex flex-col items-center justify-center h-full bg-muted/30 rounded-lg",
                className
            )}>
                <FileWarning className="h-12 w-12 text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">{error}</p>
                <Button variant="ghost" size="sm" className="mt-2" onClick={() => window.location.reload()}>
                    <RotateCw className="h-4 w-4 mr-2" />
                    重试
                </Button>
            </div>
        )
    }

    return (
        <div className={cn("flex flex-col h-full", className)}>
            {/* 工具栏 */}
            <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b shrink-0">
                {/* 页面信息 */}
                <span className="text-sm text-muted-foreground">
                    {loading ? "加载中..." : `共 ${numPages} 页`}
                </span>

                {/* 缩放控制 */}
                <div className="flex items-center gap-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={zoomOut}
                        disabled={scale <= 0.5}
                    >
                        <ZoomOut className="h-4 w-4" />
                    </Button>
                    <button
                        className="text-sm text-muted-foreground min-w-[50px] text-center hover:text-foreground transition-colors"
                        onClick={resetZoom}
                    >
                        {Math.round(scale * 100)}%
                    </button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={zoomIn}
                        disabled={scale >= 2.5}
                    >
                        <ZoomIn className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* PDF 渲染区域 - 垂直滚动所有页面 */}
            <div id="pdf-scroll-container" className="flex-1 overflow-auto bg-muted/20 min-h-0">
                <div className="flex flex-col items-center gap-4 p-4">
                    {loading && (
                        <div className="flex items-center justify-center h-64">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    )}
                    <Document
                        file={url}
                        onLoadSuccess={onDocumentLoadSuccess}
                        onLoadError={onDocumentLoadError}
                        loading={null}
                        className="flex flex-col items-center gap-4"
                    >
                        {/* 渲染所有页面 */}
                        {Array.from(new Array(numPages), (_, index) => (
                            <Page
                                key={`page_${index + 1}`}
                                pageNumber={index + 1}
                                scale={scale}
                                width={Math.min(containerWidth, 800)}
                                renderTextLayer={false}
                                renderAnnotationLayer={false}
                                className="shadow-lg bg-white"
                            />
                        ))}
                    </Document>
                </div>
            </div>
        </div>
    )
}
