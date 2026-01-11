import { useEffect, useRef, useState, useCallback } from 'react'
import type { WebSocketMessage, SensorReading } from '../types'

interface UseWebSocketOptions {
  onReading?: (reading: SensorReading) => void
  onStatus?: (status: unknown) => void
  onError?: (error: string) => void
  reconnectInterval?: number
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const { onReading, onStatus, onError, reconnectInterval = 5000 } = options

  const [connected, setConnected] = useState(false)
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/ws`

    const ws = new WebSocket(wsUrl)

    ws.onopen = () => {
      setConnected(true)
      console.log('WebSocket connected')
    }

    ws.onclose = () => {
      setConnected(false)
      console.log('WebSocket disconnected')

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
  }, [onReading, onStatus, onError, reconnectInterval])

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
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
