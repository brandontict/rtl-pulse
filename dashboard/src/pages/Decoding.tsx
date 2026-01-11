import { useState, useEffect, useRef } from 'react'
import {
  Radio,
  Clock,
  Thermometer,
  Droplets,
  Battery,
  Signal,
  Trash2,
  Pause,
  Play,
  Download,
  Code,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  Copy,
  Search,
  Terminal,
} from 'lucide-react'

interface DecodedSignal {
  id: string
  timestamp: string
  time: string
  model: string
  protocol?: number
  id_device?: number | string
  channel?: number
  battery_ok?: number
  temperature_C?: number
  humidity?: number
  pressure_hPa?: number
  wind_avg_km_h?: number
  rain_mm?: number
  rssi?: number
  snr?: number
  noise?: number
  raw: Record<string, unknown>
}

interface ProtocolStats {
  model: string
  count: number
  lastSeen: string
  devices: Set<string>
}

const WS_URL = `ws://${window.location.hostname}:8000/ws`

export default function Decoding() {
  const [signals, setSignals] = useState<DecodedSignal[]>([])
  const [connected, setConnected] = useState(false)
  const [paused, setPaused] = useState(false)
  const [filter, setFilter] = useState('')
  const [selectedSignal, setSelectedSignal] = useState<DecodedSignal | null>(null)
  const [showRaw, setShowRaw] = useState(false)
  const [protocolStats, setProtocolStats] = useState<Map<string, ProtocolStats>>(new Map())
  const [expandedProtocols, setExpandedProtocols] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<'list' | 'protocol' | 'log'>('list')
  const [autoScroll, setAutoScroll] = useState(true)
  const logContainerRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const signalIdRef = useRef(0)
  const maxSignals = 500

  useEffect(() => {
    connectWebSocket()
    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [])

  // Auto-scroll to bottom in log view
  useEffect(() => {
    if (autoScroll && viewMode === 'log' && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
    }
  }, [signals, autoScroll, viewMode])

  function connectWebSocket() {
    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onopen = () => {
      setConnected(true)
      console.log('Decoding WebSocket connected')
    }

    ws.onmessage = (event) => {
      if (paused) return

      try {
        const data = JSON.parse(event.data)

        // Handle reading events from rtl_433
        if (data.type === 'reading' && data.data) {
          const reading = data.data
          const signal: DecodedSignal = {
            id: `sig-${signalIdRef.current++}`,
            timestamp: new Date().toISOString(),
            time: reading.time || new Date().toLocaleTimeString(),
            model: reading.model || 'Unknown',
            protocol: reading.protocol,
            id_device: reading.id,
            channel: reading.channel,
            battery_ok: reading.battery_ok,
            temperature_C: reading.temperature_C,
            humidity: reading.humidity,
            pressure_hPa: reading.pressure_hPa,
            wind_avg_km_h: reading.wind_avg_km_h,
            rain_mm: reading.rain_mm,
            rssi: reading.rssi,
            snr: reading.snr,
            noise: reading.noise,
            raw: reading,
          }

          setSignals(prev => {
            const updated = [signal, ...prev].slice(0, maxSignals)
            return updated
          })

          // Update protocol stats
          setProtocolStats(prev => {
            const stats = new Map(prev)
            const existing = stats.get(signal.model) || {
              model: signal.model,
              count: 0,
              lastSeen: signal.timestamp,
              devices: new Set<string>(),
            }
            existing.count++
            existing.lastSeen = signal.timestamp
            if (signal.id_device !== undefined) {
              existing.devices.add(String(signal.id_device))
            }
            stats.set(signal.model, existing)
            return stats
          })
        }
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err)
      }
    }

    ws.onclose = () => {
      setConnected(false)
      console.log('Decoding WebSocket disconnected')
      // Reconnect after 3 seconds
      setTimeout(connectWebSocket, 3000)
    }

    ws.onerror = (err) => {
      console.error('WebSocket error:', err)
    }
  }

  function clearSignals() {
    setSignals([])
    setProtocolStats(new Map())
    setSelectedSignal(null)
  }

  function exportSignals() {
    const data = JSON.stringify(signals, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `decoded-signals-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text)
  }

  function toggleProtocol(model: string) {
    setExpandedProtocols(prev => {
      const next = new Set(prev)
      if (next.has(model)) {
        next.delete(model)
      } else {
        next.add(model)
      }
      return next
    })
  }

  const filteredSignals = signals.filter(sig => {
    if (!filter) return true
    const searchLower = filter.toLowerCase()
    return (
      sig.model.toLowerCase().includes(searchLower) ||
      String(sig.id_device).includes(searchLower) ||
      JSON.stringify(sig.raw).toLowerCase().includes(searchLower)
    )
  })

  const signalsByProtocol = filteredSignals.reduce((acc, sig) => {
    if (!acc[sig.model]) acc[sig.model] = []
    acc[sig.model].push(sig)
    return acc
  }, {} as Record<string, DecodedSignal[]>)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 flex items-center">
            <Code className="h-5 w-5 mr-2 text-purple-600" />
            Signal Decoder
          </h2>
          <p className="text-sm text-gray-500">Real-time protocol decoding and analysis</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Connection Status */}
          <div className={`flex items-center px-3 py-1.5 rounded-full text-sm ${
            connected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}>
            {connected ? (
              <>
                <CheckCircle className="h-4 w-4 mr-1.5" />
                Live
              </>
            ) : (
              <>
                <AlertCircle className="h-4 w-4 mr-1.5" />
                Disconnected
              </>
            )}
          </div>

          {/* Signal Count */}
          <div className="px-3 py-1.5 bg-gray-100 rounded-full text-sm text-gray-700">
            {signals.length} signals
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Search/Filter */}
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter by model, ID, or data..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'list' ? 'bg-white shadow text-purple-700' : 'text-gray-600'
              }`}
            >
              List
            </button>
            <button
              onClick={() => setViewMode('protocol')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'protocol' ? 'bg-white shadow text-purple-700' : 'text-gray-600'
              }`}
            >
              Protocol
            </button>
            <button
              onClick={() => setViewMode('log')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center ${
                viewMode === 'log' ? 'bg-white shadow text-purple-700' : 'text-gray-600'
              }`}
            >
              <Terminal className="h-3 w-3 mr-1" />
              Log
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPaused(!paused)}
              className={`inline-flex items-center px-3 py-2 rounded-md text-sm font-medium ${
                paused
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-yellow-500 text-white hover:bg-yellow-600'
              }`}
            >
              {paused ? <Play className="h-4 w-4 mr-1.5" /> : <Pause className="h-4 w-4 mr-1.5" />}
              {paused ? 'Resume' : 'Pause'}
            </button>

            <button
              onClick={() => setShowRaw(!showRaw)}
              className={`inline-flex items-center px-3 py-2 rounded-md text-sm font-medium border ${
                showRaw
                  ? 'bg-purple-100 text-purple-700 border-purple-300'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {showRaw ? <EyeOff className="h-4 w-4 mr-1.5" /> : <Eye className="h-4 w-4 mr-1.5" />}
              Raw Data
            </button>

            <button
              onClick={exportSignals}
              disabled={signals.length === 0}
              className="inline-flex items-center px-3 py-2 rounded-md text-sm font-medium bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
            >
              <Download className="h-4 w-4 mr-1.5" />
              Export
            </button>

            <button
              onClick={clearSignals}
              className="inline-flex items-center px-3 py-2 rounded-md text-sm font-medium bg-white text-red-600 border border-red-300 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* Protocol Stats */}
      {protocolStats.size > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
            <Signal className="h-4 w-4 mr-2 text-purple-600" />
            Detected Protocols ({protocolStats.size})
          </h3>
          <div className="flex flex-wrap gap-2">
            {Array.from(protocolStats.entries()).map(([model, stats]) => (
              <div
                key={model}
                className="inline-flex items-center px-3 py-1.5 rounded-full text-sm bg-purple-50 text-purple-700 border border-purple-200"
              >
                <Radio className="h-3 w-3 mr-1.5" />
                <span className="font-medium">{model}</span>
                <span className="mx-1.5 text-purple-400">|</span>
                <span>{stats.count}x</span>
                <span className="mx-1.5 text-purple-400">|</span>
                <span>{stats.devices.size} device{stats.devices.size !== 1 ? 's' : ''}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Signal List */}
        <div className={`${selectedSignal ? 'lg:col-span-2' : 'lg:col-span-3'} bg-white rounded-lg shadow-sm border border-gray-200`}>
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-sm font-medium text-gray-700">
              {viewMode === 'list' ? 'Signal Feed' : 'Signals by Protocol'}
              {filteredSignals.length !== signals.length && (
                <span className="text-gray-400 ml-2">
                  (showing {filteredSignals.length} of {signals.length})
                </span>
              )}
            </h3>
          </div>

          <div className={`overflow-y-auto ${viewMode === 'log' ? 'max-h-[600px]' : 'max-h-[500px]'}`} ref={logContainerRef}>
            {filteredSignals.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <Radio className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No signals decoded yet</p>
                <p className="text-sm">Waiting for rtl_433 data...</p>
              </div>
            ) : viewMode === 'log' ? (
              /* Terminal Log View */
              <div className="bg-gray-900 p-4 font-mono text-sm min-h-[400px]">
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-700">
                  <div className="flex items-center text-green-400">
                    <Terminal className="h-4 w-4 mr-2" />
                    <span>Signal Log</span>
                    <span className="ml-2 text-gray-500">|</span>
                    <span className="ml-2 text-gray-400">{filteredSignals.length} entries</span>
                  </div>
                  <button
                    onClick={() => setAutoScroll(!autoScroll)}
                    className={`text-xs px-2 py-1 rounded ${
                      autoScroll ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-400'
                    }`}
                  >
                    Auto-scroll: {autoScroll ? 'ON' : 'OFF'}
                  </button>
                </div>
                <div className="space-y-1">
                  {[...filteredSignals].reverse().map((sig, idx) => (
                    <LogEntry
                      key={sig.id}
                      signal={sig}
                      index={filteredSignals.length - idx}
                      onClick={() => setSelectedSignal(sig)}
                      isSelected={selectedSignal?.id === sig.id}
                    />
                  ))}
                </div>
              </div>
            ) : viewMode === 'list' ? (
              <div className="divide-y divide-gray-100">
                {filteredSignals.map((sig) => (
                  <SignalRow
                    key={sig.id}
                    signal={sig}
                    showRaw={showRaw}
                    isSelected={selectedSignal?.id === sig.id}
                    onClick={() => setSelectedSignal(sig)}
                  />
                ))}
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {Object.entries(signalsByProtocol).map(([model, sigs]) => (
                  <div key={model}>
                    <button
                      onClick={() => toggleProtocol(model)}
                      className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50"
                    >
                      <div className="flex items-center">
                        {expandedProtocols.has(model) ? (
                          <ChevronDown className="h-4 w-4 mr-2 text-gray-400" />
                        ) : (
                          <ChevronRight className="h-4 w-4 mr-2 text-gray-400" />
                        )}
                        <span className="font-medium text-gray-900">{model}</span>
                        <span className="ml-2 px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">
                          {sigs.length}
                        </span>
                      </div>
                    </button>
                    {expandedProtocols.has(model) && (
                      <div className="bg-gray-50 divide-y divide-gray-100">
                        {sigs.map((sig) => (
                          <SignalRow
                            key={sig.id}
                            signal={sig}
                            showRaw={showRaw}
                            isSelected={selectedSignal?.id === sig.id}
                            onClick={() => setSelectedSignal(sig)}
                            compact
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Signal Detail Panel */}
        {selectedSignal && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-700">Signal Details</h3>
              <button
                onClick={() => setSelectedSignal(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
            <div className="p-4 space-y-4">
              {/* Model */}
              <div>
                <div className="text-xs text-gray-500 mb-1">Protocol/Model</div>
                <div className="text-lg font-semibold text-purple-700">{selectedSignal.model}</div>
              </div>

              {/* Time */}
              <div>
                <div className="text-xs text-gray-500 mb-1">Received</div>
                <div className="flex items-center text-gray-900">
                  <Clock className="h-4 w-4 mr-1.5 text-gray-400" />
                  {new Date(selectedSignal.timestamp).toLocaleString()}
                </div>
              </div>

              {/* Device Info */}
              {(selectedSignal.id_device !== undefined || selectedSignal.channel !== undefined) && (
                <div className="grid grid-cols-2 gap-4">
                  {selectedSignal.id_device !== undefined && (
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Device ID</div>
                      <div className="font-mono text-gray-900">{selectedSignal.id_device}</div>
                    </div>
                  )}
                  {selectedSignal.channel !== undefined && (
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Channel</div>
                      <div className="text-gray-900">{selectedSignal.channel}</div>
                    </div>
                  )}
                </div>
              )}

              {/* Sensor Data */}
              <div className="grid grid-cols-2 gap-3">
                {selectedSignal.temperature_C !== undefined && (
                  <div className="p-3 bg-orange-50 rounded-lg">
                    <div className="flex items-center text-orange-600 text-xs mb-1">
                      <Thermometer className="h-3 w-3 mr-1" />
                      Temperature
                    </div>
                    <div className="text-xl font-bold text-orange-700">
                      {selectedSignal.temperature_C.toFixed(1)}°C
                    </div>
                  </div>
                )}
                {selectedSignal.humidity !== undefined && (
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <div className="flex items-center text-blue-600 text-xs mb-1">
                      <Droplets className="h-3 w-3 mr-1" />
                      Humidity
                    </div>
                    <div className="text-xl font-bold text-blue-700">
                      {selectedSignal.humidity}%
                    </div>
                  </div>
                )}
                {selectedSignal.battery_ok !== undefined && (
                  <div className={`p-3 rounded-lg ${
                    selectedSignal.battery_ok ? 'bg-green-50' : 'bg-red-50'
                  }`}>
                    <div className={`flex items-center text-xs mb-1 ${
                      selectedSignal.battery_ok ? 'text-green-600' : 'text-red-600'
                    }`}>
                      <Battery className="h-3 w-3 mr-1" />
                      Battery
                    </div>
                    <div className={`text-xl font-bold ${
                      selectedSignal.battery_ok ? 'text-green-700' : 'text-red-700'
                    }`}>
                      {selectedSignal.battery_ok ? 'OK' : 'LOW'}
                    </div>
                  </div>
                )}
                {selectedSignal.rssi !== undefined && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center text-gray-600 text-xs mb-1">
                      <Signal className="h-3 w-3 mr-1" />
                      RSSI
                    </div>
                    <div className="text-xl font-bold text-gray-700">
                      {selectedSignal.rssi} dB
                    </div>
                  </div>
                )}
              </div>

              {/* Raw JSON */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs text-gray-500">Raw Data</div>
                  <button
                    onClick={() => copyToClipboard(JSON.stringify(selectedSignal.raw, null, 2))}
                    className="text-xs text-purple-600 hover:text-purple-800 flex items-center"
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Copy
                  </button>
                </div>
                <pre className="p-3 bg-gray-900 text-green-400 rounded-lg text-xs overflow-x-auto max-h-[200px]">
                  {JSON.stringify(selectedSignal.raw, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Help */}
      <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
        <h3 className="text-sm font-medium text-purple-800 mb-2">Signal Decoder Tips</h3>
        <ul className="text-sm text-purple-700 space-y-1">
          <li>• Signals are decoded in real-time from rtl_433</li>
          <li>• Click a signal to see full details and raw JSON</li>
          <li>• Use "By Protocol" view to group signals by device type</li>
          <li>• Export captured signals for offline analysis</li>
          <li>• Filter by model name, device ID, or any data field</li>
        </ul>
      </div>
    </div>
  )
}

// Signal Row Component
function SignalRow({
  signal,
  showRaw,
  isSelected,
  onClick,
  compact = false,
}: {
  signal: DecodedSignal
  showRaw: boolean
  isSelected: boolean
  onClick: () => void
  compact?: boolean
}) {
  return (
    <div
      onClick={onClick}
      className={`px-4 py-3 cursor-pointer transition-colors ${
        isSelected ? 'bg-purple-50' : 'hover:bg-gray-50'
      } ${compact ? 'pl-10' : ''}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className={`font-medium ${compact ? 'text-sm' : ''} text-gray-900`}>
              {signal.model}
            </span>
            {signal.id_device !== undefined && (
              <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
                ID: {signal.id_device}
              </span>
            )}
            {signal.channel !== undefined && (
              <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded">
                CH{signal.channel}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 mt-1 text-sm text-gray-600">
            {signal.temperature_C !== undefined && (
              <span className="flex items-center">
                <Thermometer className="h-3 w-3 mr-1 text-orange-500" />
                {signal.temperature_C.toFixed(1)}°C
              </span>
            )}
            {signal.humidity !== undefined && (
              <span className="flex items-center">
                <Droplets className="h-3 w-3 mr-1 text-blue-500" />
                {signal.humidity}%
              </span>
            )}
            {signal.battery_ok !== undefined && (
              <span className={`flex items-center ${signal.battery_ok ? 'text-green-600' : 'text-red-600'}`}>
                <Battery className="h-3 w-3 mr-1" />
                {signal.battery_ok ? 'OK' : 'Low'}
              </span>
            )}
          </div>

          {showRaw && (
            <pre className="mt-2 p-2 bg-gray-100 rounded text-xs text-gray-600 overflow-x-auto">
              {JSON.stringify(signal.raw, null, 2)}
            </pre>
          )}
        </div>

        <div className="text-xs text-gray-400 whitespace-nowrap ml-4">
          {signal.time}
        </div>
      </div>
    </div>
  )
}

// Terminal Log Entry Component
function LogEntry({
  signal,
  index,
  onClick,
  isSelected,
}: {
  signal: DecodedSignal
  index: number
  onClick: () => void
  isSelected: boolean
}) {
  const date = new Date(signal.timestamp)
  const timestamp = date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }) + '.' + String(date.getMilliseconds()).padStart(3, '0')

  // Build data string
  const dataFields: string[] = []
  if (signal.id_device !== undefined) dataFields.push(`id=${signal.id_device}`)
  if (signal.channel !== undefined) dataFields.push(`ch=${signal.channel}`)
  if (signal.temperature_C !== undefined) dataFields.push(`temp=${signal.temperature_C.toFixed(1)}°C`)
  if (signal.humidity !== undefined) dataFields.push(`hum=${signal.humidity}%`)
  if (signal.battery_ok !== undefined) dataFields.push(`bat=${signal.battery_ok ? 'OK' : 'LOW'}`)
  if (signal.rssi !== undefined) dataFields.push(`rssi=${signal.rssi}dB`)
  if (signal.pressure_hPa !== undefined) dataFields.push(`pres=${signal.pressure_hPa}hPa`)
  if (signal.wind_avg_km_h !== undefined) dataFields.push(`wind=${signal.wind_avg_km_h}km/h`)
  if (signal.rain_mm !== undefined) dataFields.push(`rain=${signal.rain_mm}mm`)

  return (
    <div
      onClick={onClick}
      className={`flex items-start cursor-pointer hover:bg-gray-800 px-2 py-0.5 rounded transition-colors ${
        isSelected ? 'bg-gray-800 ring-1 ring-purple-500' : ''
      }`}
    >
      {/* Line number */}
      <span className="text-gray-600 w-12 flex-shrink-0 select-none">
        {String(index).padStart(4, ' ')}
      </span>

      {/* Timestamp */}
      <span className="text-cyan-400 w-28 flex-shrink-0">
        [{timestamp}]
      </span>

      {/* Model/Protocol */}
      <span className="text-yellow-400 w-32 flex-shrink-0 truncate" title={signal.model}>
        {signal.model}
      </span>

      {/* Data fields */}
      <span className="text-gray-300 flex-1">
        {dataFields.length > 0 ? (
          dataFields.map((field, i) => (
            <span key={i}>
              {i > 0 && <span className="text-gray-600"> | </span>}
              <span className={
                field.startsWith('temp=') ? 'text-orange-400' :
                field.startsWith('hum=') ? 'text-blue-400' :
                field.startsWith('bat=LOW') ? 'text-red-400' :
                field.startsWith('bat=') ? 'text-green-400' :
                field.startsWith('rssi=') ? 'text-purple-400' :
                'text-gray-300'
              }>
                {field}
              </span>
            </span>
          ))
        ) : (
          <span className="text-gray-500">no data</span>
        )}
      </span>
    </div>
  )
}
