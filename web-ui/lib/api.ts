import { DocumentsResponse } from "./types"

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000"

// ============ 请求取消管理 ============
const activeRequests = new Map<string, AbortController>()

/**
 * 取消指定 key 的进行中请求
 */
export function cancelRequest(key: string): void {
  const controller = activeRequests.get(key)
  if (controller) {
    controller.abort()
    activeRequests.delete(key)
  }
}

/**
 * 取消所有进行中的请求
 */
export function cancelAllRequests(): void {
  activeRequests.forEach((controller) => controller.abort())
  activeRequests.clear()
}

/**
 * 创建可取消的 AbortController
 */
function createAbortController(key?: string): AbortController {
  const controller = new AbortController()
  if (key) {
    // 取消之前同 key 的请求
    cancelRequest(key)
    activeRequests.set(key, controller)
  }
  return controller
}

// ============ JSON 解析 ============
async function parseJsonSafe(response: Response) {
  try {
    return await response.json()
  } catch {
    return null
  }
}

/**
 * 解析错误响应，返回用户友好的错误消息
 */
function parseErrorMessage(data: any, res: Response): string {
  if (data) {
    // 支持新的统一错误格式
    if (data.message) return data.message
    if (data.detail) return typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail)
    if (data.error) return data.error
  }
  
  // HTTP 状态码友好提示
  const statusMessages: Record<number, string> = {
    400: '请求参数错误',
    401: '未授权，请检查 API 配置',
    403: '访问被拒绝',
    404: '请求的资源不存在',
    500: '服务器内部错误',
    502: '服务器无法连接',
    503: '服务暂时不可用',
    504: '请求超时'
  }
  
  return statusMessages[res.status] || res.statusText || '请求失败，请稍后重试'
}

// ============ 基础 API 请求 ============
export async function apiGet<T>(path: string, options?: { key?: string }): Promise<T> {
  const controller = createAbortController(options?.key)
  
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      signal: controller.signal
    })
    const data = await parseJsonSafe(res)

    if (!res.ok) {
      throw new Error(parseErrorMessage(data, res))
    }

    return data as T
  } finally {
    if (options?.key) {
      activeRequests.delete(options.key)
    }
  }
}

export async function apiPost<T, B = any>(path: string, body: B, options?: { key?: string }): Promise<T> {
  const controller = createAbortController(options?.key)
  
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal
    })

    const data = await parseJsonSafe(res)

    if (!res.ok) {
      throw new Error(parseErrorMessage(data, res))
    }

    return data as T
  } finally {
    if (options?.key) {
      activeRequests.delete(options.key)
    }
  }
}

// ============ 流式请求支持 ============
export type StreamEventType = 'start' | 'title' | 'content' | 'done' | 'error'

export interface StreamEvent {
  type: StreamEventType
  content?: string
}

export interface StreamOptions {
  key?: string
  onStart?: () => void
  onTitle?: (title: string) => void
  onContent?: (chunk: string) => void
  onDone?: () => void
  onError?: (error: string) => void
}

/**
 * 流式 POST 请求，支持 SSE (Server-Sent Events)
 */
export async function apiPostStream<B = any>(
  path: string, 
  body: B, 
  options: StreamOptions
): Promise<void> {
  const controller = createAbortController(options.key)
  
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal
    })

    if (!res.ok) {
      const data = await parseJsonSafe(res)
      throw new Error(parseErrorMessage(data, res))
    }

    if (!res.body) {
      throw new Error('服务器未返回流式数据')
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      
      if (done) break
      
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''  // 保留不完整的行
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const event: StreamEvent = JSON.parse(line.slice(6))
            
            switch (event.type) {
              case 'start':
                options.onStart?.()
                break
              case 'title':
                options.onTitle?.(event.content || '')
                break
              case 'content':
                options.onContent?.(event.content || '')
                break
              case 'done':
                options.onDone?.()
                break
              case 'error':
                options.onError?.(event.content || '未知错误')
                break
            }
          } catch {
            // 忽略解析失败的行
          }
        }
      }
    }
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        // 请求被取消，不返回错误
        return
      }
      options.onError?.(error.message)
    } else {
      options.onError?.('请求失败')
    }
  } finally {
    if (options.key) {
      activeRequests.delete(options.key)
    }
  }
}

// ============ 业务 API ============
export async function searchDocuments(query: string): Promise<DocumentsResponse> {
  return apiPost<DocumentsResponse, { query: string }>("/api/search_zotero", { query }, { key: 'search_zotero' })
}

/**
 * 检查 API 服务健康状态
 */
export async function checkHealth(): Promise<{ status: string; documents_cached: number; collection: string | null }> {
  return apiGet('/api/health')
}

export { API_BASE }
