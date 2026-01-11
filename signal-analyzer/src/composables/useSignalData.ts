import { ref, onMounted, onUnmounted } from 'vue'

const API_BASE = '/api/v1'

interface Signal {
  time: string
  model: string
  id: string | number
  data: Record<string, unknown>
}

interface Protocol {
  id: number
  name: string
  type: string
}

export function useSignalData() {
  const signals = ref<Signal[]>([])
  const isAnalyzing = ref(false)
  const error = ref<string | null>(null)

  async function analyzeSignals(duration = 10): Promise<void> {
    isAnalyzing.value = true
    error.value = null

    try {
      const response = await fetch(`${API_BASE}/signals/analyze?duration=${duration}`, {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error(`Analysis failed: ${response.statusText}`)
      }

      const data = await response.json()
      signals.value = data.signals || []
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error'
    } finally {
      isAnalyzing.value = false
    }
  }

  return {
    signals,
    isAnalyzing,
    error,
    analyzeSignals,
  }
}

export function useProtocols() {
  const protocols = ref<Protocol[]>([])
  const loading = ref(true)

  async function loadProtocols(): Promise<void> {
    try {
      const response = await fetch(`${API_BASE}/signals/protocols`)
      const data = await response.json()
      protocols.value = data.protocols || []
    } catch (err) {
      console.error('Failed to load protocols:', err)
    } finally {
      loading.value = false
    }
  }

  onMounted(loadProtocols)

  return {
    protocols,
    loading,
    reload: loadProtocols,
  }
}

export function useWebSocket() {
  const connected = ref(false)
  const lastMessage = ref<unknown>(null)
  let ws: WebSocket | null = null
  let reconnectTimeout: ReturnType<typeof setTimeout> | null = null

  function connect() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/ws`

    ws = new WebSocket(wsUrl)

    ws.onopen = () => {
      connected.value = true
    }

    ws.onclose = () => {
      connected.value = false
      reconnectTimeout = setTimeout(connect, 5000)
    }

    ws.onmessage = (event) => {
      try {
        lastMessage.value = JSON.parse(event.data)
      } catch {
        // Ignore parse errors
      }
    }
  }

  function disconnect() {
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout)
    }
    ws?.close()
    ws = null
    connected.value = false
  }

  onMounted(connect)
  onUnmounted(disconnect)

  return {
    connected,
    lastMessage,
  }
}
