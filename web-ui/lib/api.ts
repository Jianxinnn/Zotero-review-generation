import { DocumentsResponse } from "./types"

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000"

async function parseJsonSafe(response: Response) {
  try {
    return await response.json()
  } catch {
    return null
  }
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`)
  const data = await parseJsonSafe(res)

  if (!res.ok) {
    const message =
      (data && (data.detail || data.message)) ||
      res.statusText ||
      "请求失败，请稍后重试"
    throw new Error(message)
  }

  return data as T
}

export async function apiPost<T, B = any>(path: string, body: B): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

  const data = await parseJsonSafe(res)

  if (!res.ok) {
    const message =
      (data && (data.detail || data.message)) ||
      res.statusText ||
      "请求失败，请稍后重试"
    throw new Error(message)
  }

  return data as T
}

export async function searchDocuments(query: string): Promise<DocumentsResponse> {
  return apiPost<DocumentsResponse, { query: string; n_results: number }>("/api/search_zotero", {
    query,
    n_results: 100,
  })
}

export { API_BASE }


