"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { cancelRequest } from "@/lib/api"

interface UseApiRequestOptions<T> {
  /** 请求唯一标识，用于取消请求 */
  key?: string
  /** 请求成功回调 */
  onSuccess?: (data: T) => void
  /** 请求失败回调 */
  onError?: (error: Error) => void
  /** 请求完成回调（无论成功失败） */
  onFinally?: () => void
}

interface UseApiRequestReturn<T, P extends any[]> {
  /** 请求数据 */
  data: T | null
  /** 是否正在加载 */
  isLoading: boolean
  /** 错误信息 */
  error: Error | null
  /** 执行请求 */
  execute: (...args: P) => Promise<T | null>
  /** 取消请求 */
  cancel: () => void
  /** 重置状态 */
  reset: () => void
}

/**
 * 通用 API 请求 Hook
 * 提供请求状态管理、自动取消、错误处理等功能
 */
export function useApiRequest<T, P extends any[] = []>(
  requestFn: (...args: P) => Promise<T>,
  options: UseApiRequestOptions<T> = {}
): UseApiRequestReturn<T, P> {
  const [data, setData] = useState<T | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  
  const requestKeyRef = useRef(options.key || `request_${Date.now()}_${Math.random()}`)
  const mountedRef = useRef(true)
  
  // 组件卸载时取消请求
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (options.key) {
        cancelRequest(options.key)
      }
    }
  }, [options.key])
  
  const cancel = useCallback(() => {
    cancelRequest(requestKeyRef.current)
  }, [])
  
  const reset = useCallback(() => {
    setData(null)
    setError(null)
    setIsLoading(false)
  }, [])
  
  const execute = useCallback(async (...args: P): Promise<T | null> => {
    // 取消之前的请求
    cancel()
    
    setIsLoading(true)
    setError(null)
    
    try {
      const result = await requestFn(...args)
      
      // 检查组件是否仍然挂载
      if (!mountedRef.current) return null
      
      setData(result)
      options.onSuccess?.(result)
      return result
    } catch (err) {
      // 检查组件是否仍然挂载
      if (!mountedRef.current) return null
      
      // 忽略取消错误
      if (err instanceof Error && err.name === 'AbortError') {
        return null
      }
      
      const error = err instanceof Error ? err : new Error(String(err))
      setError(error)
      options.onError?.(error)
      return null
    } finally {
      if (mountedRef.current) {
        setIsLoading(false)
        options.onFinally?.()
      }
    }
  }, [requestFn, options.onSuccess, options.onError, options.onFinally, cancel])
  
  return {
    data,
    isLoading,
    error,
    execute,
    cancel,
    reset
  }
}

/**
 * 带防抖的 API 请求 Hook
 */
export function useDebouncedApiRequest<T, P extends any[] = []>(
  requestFn: (...args: P) => Promise<T>,
  delay: number = 300,
  options: UseApiRequestOptions<T> = {}
): UseApiRequestReturn<T, P> {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const baseHook = useApiRequest(requestFn, options)
  
  const debouncedExecute = useCallback(async (...args: P): Promise<T | null> => {
    // 清除之前的定时器
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    
    return new Promise((resolve) => {
      timeoutRef.current = setTimeout(async () => {
        const result = await baseHook.execute(...args)
        resolve(result)
      }, delay)
    })
  }, [baseHook.execute, delay])
  
  // 清理定时器
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])
  
  return {
    ...baseHook,
    execute: debouncedExecute
  }
}

/**
 * 请求状态类型
 */
export type RequestStatus = 'idle' | 'loading' | 'success' | 'error'

/**
 * 获取请求状态
 */
export function getRequestStatus(isLoading: boolean, error: Error | null, data: any): RequestStatus {
  if (isLoading) return 'loading'
  if (error) return 'error'
  if (data !== null) return 'success'
  return 'idle'
}
