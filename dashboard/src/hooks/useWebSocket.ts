import { useEffect, useRef, useState, useCallback } from 'react'
import type { WebSocketMessage, SensorReading } from '../types'

interface UseWebSocketOptions {
  onReading?: (reading: SensorReading) => void
  onStatus?: (status: unknown) => void
  onError?: (error: string) => void
  reconnectInterval?: number
  pingInterval?: number
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const {
    onReading,
    onStatus,
    onError,
    reconnectInterval = 5000,
    pingInterval = 30000  // Send ping every 30s to keep connection alive
  } = options

  const [connected, setConnected] = useState(false)
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return
    }

    // Clear any pending reconnect
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/ws`

    const ws = new WebSocket(wsUrl)

    ws.onopen = () => {
      setConnected(true)
      console.log('WebSocket connected')

      // Start ping interval to keep connection alive
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current)
      }
      pingIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }))
        }
      }, pingInterval)
    }

    ws.onclose = () => {
      setConnected(false)
      console.log('WebSocket disconnected')

      // Clear ping interval
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current)
        pingIntervalRef.current = null
      }

      // Reconnect after delay
      reconnectTimeoutRef.current = setTimeout(connect, reconnectInterval)
    }

    ws.onerror = (event) => {
      console.error('WebSocket error:', event)
      onError?.('WebSocket connection error')
    }

    ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data)
        setLastMessage(message)

        switch (message.type) {
          case 'reading':
            onReading?.(message.data as SensorReading)
            break
          case 'status':
            onStatus?.(message.data)
            break
          case 'error':
            onError?.((message.data as { message: string }).message)
            break
          case 'heartbeat':
          case 'pong':
            // Keepalive, no action needed
            break
        }
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err)
      }
    }

    wsRef.current = ws
  }, [onReading, onStatus, onError, reconnectInterval, pingInterval])

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current)
      pingIntervalRef.current = null
    }
    wsRef.current?.close()
    wsRef.current = null
    setConnected(false)
  }, [])

  const sendMessage = useCallback((message: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message))
    }
  }, [])

  // Handle page visibility changes - reconnect when tab becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('Tab visible - checking WebSocket connection')
        // Force reconnect if not connected or connection is stale
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          console.log('Reconnecting WebSocket after tab visibility change')
          connect()
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [connect])

  // Initial connection
  useEffect(() => {
    connect()
    return disconnect
  }, [connect, disconnect])

  return {
    connected,
    lastMessage,
    sendMessage,
    connect,
    disconnect,
  }
}
