import { useState, useEffect, useRef } from 'react'
import {
  Radio,
  Play,
  Square,
  Zap,
  RefreshCw,
  Activity,
  Volume2,
  Wifi,
  WifiOff,
  Settings2,
  AlertTriangle,
  Power,
  Sliders,
  Thermometer,
  Droplets,
  Battery,
  ChevronDown,
  ChevronUp,
  Signal,
} from 'lucide-react'
import FrequencyTuner from '../components/FrequencyTuner'

interface SpectrumPoint {
  frequency: number
  power: number
}

interface Peak {
  frequency: number
  power: number
}

interface Preset {
  name: string
  start: string
  end: string
  bin: string
  description: string
  category?: string
}

interface LiveSpectrum {
  type: string
  center_freq_mhz: number
  sample_rate_mhz: number
  frequencies: number[]
  power: number[]
  min_power: number
  max_power: number
  avg_power: number
}

interface LiveStatus {
  running: boolean
  center_freq_mhz: number
  sample_rate_mhz: number
  fft_size: number
  gain: number
  averaging: number
  clients: number
}

interface DecodedSignal {
  id: string
  timestamp: string
  model: string
  device_id?: number | string
  channel?: number
  temperature_C?: number
  humidity?: number
  battery_ok?: number
  rssi?: number
}

const API_BASE = '/api/v1'
const DECODE_WS_URL = `ws://${window.location.hostname}:8000/ws`
const WS_BASE = `ws://${window.location.hostname}:8000/api/v1`

export default function SpectrumScanner() {
  // Mode: 'scan' or 'live'
  const [mode, setMode] = useState<'scan' | 'live'>('scan')

  // Scan mode state
  const [scanning, setScanning] = useState(false)
  const [spectrum, setSpectrum] = useState<SpectrumPoint[]>([])
  const [peaks, setPeaks] = useState<Peak[]>([])
  const [presets, setPresets] = useState<Preset[]>([])
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)

  // Scan parameters
  const [startFreq, setStartFreq] = useState('432M')
  const [endFreq, setEndFreq] = useState('436M')
  const [binSize, setBinSize] = useState('50k')
  const [integration, setIntegration] = useState(10)
  const [gain, setGain] = useState(40)

  // Stats
  const [avgPower, setAvgPower] = useState<number | null>(null)
  const [totalPoints, setTotalPoints] = useState(0)

  // Live mode state
  const [liveConnected, setLiveConnected] = useState(false)
  const [liveRunning, setLiveRunning] = useState(false)
  const [liveSpectrum, setLiveSpectrum] = useState<LiveSpectrum | null>(null)
  const [liveStatus, setLiveStatus] = useState<LiveStatus | null>(null)
  const wsRef = useRef<WebSocket | null>(null)

  // Live parameters
  const [liveCenterFreq, setLiveCenterFreq] = useState('433.92M')
  const [liveSampleRate, setLiveSampleRate] = useState('2.048M')
  const [liveFftSize, setLiveFftSize] = useState(1024)
  const [liveGain, setLiveGain] = useState(40)
  const [liveAveraging, setLiveAveraging] = useState(4)

  // RTL-433 state
  const [rtl433Running, setRtl433Running] = useState(false)
  const [stoppingRtl433, setStoppingRtl433] = useState(false)

  // Tuner state
  const [showTuner, setShowTuner] = useState(false)
  const [tunerFreq, setTunerFreq] = useState(433.92)

  // Decode panel state
  const [showDecodePanel, setShowDecodePanel] = useState(true)
  const [decodedSignals, setDecodedSignals] = useState<DecodedSignal[]>([])
  const [decodeConnected, setDecodeConnected] = useState(false)
  const decodeWsRef = useRef<WebSocket | null>(null)
  const signalIdRef = useRef(0)
  const maxDecodedSignals = 50

  useEffect(() => {
    loadPresets()
    checkLiveStatus()
    checkRtl433Status()
  }, [])

  // Cleanup WebSocket on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
      if (decodeWsRef.current) {
        decodeWsRef.current.close()
      }
    }
  }, [])

  // Connect to decode WebSocket when rtl433 is running
  useEffect(() => {
    if (rtl433Running && showDecodePanel) {
      connectDecodeWebSocket()
    } else if (decodeWsRef.current) {
      decodeWsRef.current.close()
    }
  }, [rtl433Running, showDecodePanel])

  function connectDecodeWebSocket() {
    if (decodeWsRef.current?.readyState === WebSocket.OPEN) return

    const ws = new WebSocket(DECODE_WS_URL)
    decodeWsRef.current = ws

    ws.onopen = () => {
      setDecodeConnected(true)
      console.log('Decode WebSocket connected')
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'reading' && data.data) {
          const reading = data.data
          const signal: DecodedSignal = {
            id: `dec-${signalIdRef.current++}`,
            timestamp: new Date().toISOString(),
            model: reading.model || 'Unknown',
            device_id: reading.id,
            channel: reading.channel,
            temperature_C: reading.temperature_C,
            humidity: reading.humidity,
            battery_ok: reading.battery_ok,
            rssi: reading.rssi,
          }
          setDecodedSignals(prev => [signal, ...prev].slice(0, maxDecodedSignals))
        }
      } catch (err) {
        console.error('Failed to parse decode message:', err)
      }
    }

    ws.onclose = () => {
      setDecodeConnected(false)
      // Reconnect if rtl433 is still running
      if (rtl433Running) {
        setTimeout(connectDecodeWebSocket, 3000)
      }
    }

    ws.onerror = (err) => {
      console.error('Decode WebSocket error:', err)
    }
  }

  async function loadPresets() {
    try {
      const response = await fetch(`${API_BASE}/signals/spectrum/presets`)
      const data = await response.json()
      setPresets(data.presets || [])
    } catch (err) {
      console.error('Failed to load presets:', err)
    }
  }

  async function checkLiveStatus() {
    try {
      const response = await fetch(`${API_BASE}/spectrum/live/status`)
      const data = await response.json()
      setLiveStatus(data)
      setLiveRunning(data.running)
    } catch (err) {
      console.error('Failed to check live status:', err)
    }
  }

  async function checkRtl433Status() {
    try {
      const response = await fetch(`${API_BASE}/system/rtl433/status`)
      const data = await response.json()
      setRtl433Running(data.running)
    } catch (err) {
      console.error('Failed to check rtl_433 status:', err)
    }
  }

  async function stopRtl433() {
    setStoppingRtl433(true)
    setError(null)
    try {
      const response = await fetch(`${API_BASE}/system/rtl433/stop`, { method: 'POST' })
      if (!response.ok) {
        throw new Error('Failed to stop rtl_433')
      }
      setRtl433Running(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop rtl_433')
    } finally {
      setStoppingRtl433(false)
    }
  }

  async function startRtl433() {
    try {
      const response = await fetch(`${API_BASE}/system/rtl433/start`, { method: 'POST' })
      if (response.ok) {
        setRtl433Running(true)
      }
    } catch (err) {
      console.error('Failed to start rtl_433:', err)
    }
  }

  function applyPreset(preset: Preset) {
    setStartFreq(preset.start)
    setEndFreq(preset.end)
    setBinSize(preset.bin)

    // For live mode, set center frequency to middle of preset range
    const startMhz = parseFloat(preset.start.replace('M', ''))
    const endMhz = parseFloat(preset.end.replace('M', ''))
    const centerMhz = (startMhz + endMhz) / 2
    setLiveCenterFreq(`${centerMhz}M`)
    setTunerFreq(centerMhz)
  }

  // Convert presets to tuner format
  function getTunerPresets() {
    return presets.map(p => {
      const startMhz = parseFloat(p.start.replace('M', ''))
      const endMhz = parseFloat(p.end.replace('M', ''))
      return {
        name: p.name,
        frequency: (startMhz + endMhz) / 2,
        category: p.category,
      }
    })
  }

  // Handle tuner frequency change
  function handleTunerChange(freq: number) {
    setTunerFreq(freq)
    setLiveCenterFreq(`${freq}M`)
  }

  // Start live with current tuner frequency
  async function startLiveFromTuner() {
    await stopRtl433()
    setLiveCenterFreq(`${tunerFreq}M`)
    // Small delay to ensure rtl433 is stopped
    setTimeout(() => startLive(), 500)
  }

  // ===== SCAN MODE FUNCTIONS =====
  async function startScan() {
    setScanning(true)
    setError(null)
    setSpectrum([])
    setPeaks([])
    setProgress(0)

    const progressInterval = setInterval(() => {
      setProgress(p => Math.min(p + 100 / integration, 95))
    }, 1000)

    try {
      const params = new URLSearchParams({
        start_freq: startFreq,
        end_freq: endFreq,
        bin_size: binSize,
        integration: integration.toString(),
        gain: gain.toString(),
      })

      const response = await fetch(`${API_BASE}/signals/spectrum/scan?${params}`, {
        method: 'POST',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.detail || 'Scan failed')
      }

      const data = await response.json()
      setSpectrum(data.spectrum || [])
      setPeaks(data.peaks || [])
      setAvgPower(data.average_power)
      setTotalPoints(data.total_points)
      setProgress(100)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan failed')
    } finally {
      clearInterval(progressInterval)
      setScanning(false)
    }
  }

  // ===== LIVE MODE FUNCTIONS =====
  async function startLive() {
    setError(null)
    try {
      const params = new URLSearchParams({
        center_freq: liveCenterFreq,
        sample_rate: liveSampleRate,
        fft_size: liveFftSize.toString(),
        gain: liveGain.toString(),
        averaging: liveAveraging.toString(),
      })

      const response = await fetch(`${API_BASE}/spectrum/live/start?${params}`, {
        method: 'POST',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.detail || 'Failed to start live spectrum')
      }

      setLiveRunning(true)
      connectWebSocket()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start live spectrum')
    }
  }

  async function stopLive() {
    try {
      await fetch(`${API_BASE}/spectrum/live/stop`, { method: 'POST' })
      setLiveRunning(false)
      if (wsRef.current) {
        wsRef.current.close()
      }
    } catch (err) {
      console.error('Failed to stop live spectrum:', err)
    }
  }

  function connectWebSocket() {
    if (wsRef.current) {
      wsRef.current.close()
    }

    const ws = new WebSocket(`${WS_BASE}/spectrum/live/ws`)
    wsRef.current = ws

    ws.onopen = () => {
      setLiveConnected(true)
      console.log('Live spectrum WebSocket connected')
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'spectrum') {
          setLiveSpectrum(data)
        } else if (data.type === 'status') {
          setLiveStatus(data.data)
        }
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err)
      }
    }

    ws.onclose = () => {
      setLiveConnected(false)
      console.log('Live spectrum WebSocket disconnected')
    }

    ws.onerror = (err) => {
      console.error('WebSocket error:', err)
      setError('WebSocket connection error')
    }
  }

  // ===== CHART RENDERING =====
  const chartWidth = 800
  const chartHeight = 300
  const padding = 40

  function getScanChartPath(): string {
    if (spectrum.length === 0) return ''

    const minPower = Math.min(...spectrum.map(p => p.power))
    const maxPower = Math.max(...spectrum.map(p => p.power))
    const powerRange = maxPower - minPower || 1

    const points = spectrum.map((point, i) => {
      const x = padding + (i / (spectrum.length - 1)) * (chartWidth - 2 * padding)
      const y = chartHeight - padding - ((point.power - minPower) / powerRange) * (chartHeight - 2 * padding)
      return `${x},${y}`
    })

    return `M ${points.join(' L ')}`
  }

  function getLiveChartPath(): string {
    if (!liveSpectrum || !liveSpectrum.frequencies.length) return ''

    const minPower = liveSpectrum.min_power
    const maxPower = liveSpectrum.max_power
    const powerRange = maxPower - minPower || 1

    const points = liveSpectrum.power.map((power, i) => {
      const x = padding + (i / (liveSpectrum.power.length - 1)) * (chartWidth - 2 * padding)
      const y = chartHeight - padding - ((power - minPower) / powerRange) * (chartHeight - 2 * padding)
      return `${x},${y}`
    })

    return `M ${points.join(' L ')}`
  }

  function getPeakMarkers() {
    if (spectrum.length === 0 || peaks.length === 0) return []

    const minPower = Math.min(...spectrum.map(p => p.power))
    const maxPower = Math.max(...spectrum.map(p => p.power))
    const powerRange = maxPower - minPower || 1
    const minFreq = spectrum[0]?.frequency || 0
    const maxFreq = spectrum[spectrum.length - 1]?.frequency || 1
    const freqRange = maxFreq - minFreq || 1

    return peaks.slice(0, 10).map(peak => {
      const x = padding + ((peak.frequency - minFreq) / freqRange) * (chartWidth - 2 * padding)
      const y = chartHeight - padding - ((peak.power - minPower) / powerRange) * (chartHeight - 2 * padding)
      return { x, y, freq: peak.frequency, power: peak.power }
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 flex items-center">
            <Activity className="h-5 w-5 mr-2 text-blue-600" />
            Spectrum Scanner
          </h2>
          <p className="text-sm text-gray-500">Find active frequencies in your area</p>
        </div>

        {/* Mode Toggle */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setMode('scan')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                mode === 'scan'
                  ? 'bg-white shadow text-blue-700'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Scan Mode
            </button>
            <button
              onClick={() => setMode('live')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center ${
                mode === 'live'
                  ? 'bg-white shadow text-green-700'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {liveConnected ? (
                <Wifi className="h-4 w-4 mr-1.5 text-green-500" />
              ) : (
                <WifiOff className="h-4 w-4 mr-1.5" />
              )}
              Live Mode
            </button>
          </div>

          {/* Tuner Toggle */}
          <button
            onClick={() => setShowTuner(!showTuner)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center ${
              showTuner
                ? 'bg-amber-100 text-amber-700 border border-amber-300'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Sliders className="h-4 w-4 mr-1.5" />
            Radio Tuner
          </button>
        </div>
      </div>

      {/* Frequency Tuner (Radio Style) */}
      {showTuner && (
        <FrequencyTuner
          frequency={tunerFreq}
          onFrequencyChange={handleTunerChange}
          minFreq={24}
          maxFreq={1700}
          step={0.1}
          presets={getTunerPresets()}
          isPlaying={liveRunning}
          onPlayStop={() => {
            if (liveRunning) {
              stopLive()
            } else if (!rtl433Running) {
              startLive()
            } else {
              startLiveFromTuner()
            }
          }}
          onPresetSelect={(preset) => {
            // Find original preset and apply it
            const original = presets.find(p => {
              const startMhz = parseFloat(p.start.replace('M', ''))
              const endMhz = parseFloat(p.end.replace('M', ''))
              return Math.abs((startMhz + endMhz) / 2 - preset.frequency) < 0.01
            })
            if (original) applyPreset(original)
          }}
        />
      )}

      {/* Presets */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Quick Presets</h3>

        {/* Car Keyfob Presets */}
        {presets.filter(p => p.category === 'car_keyfob').length > 0 && (
          <div className="mb-3">
            <div className="text-xs font-medium text-purple-600 mb-2 flex items-center">
              <span className="bg-purple-100 px-2 py-0.5 rounded">Car Keyfobs</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {presets.filter(p => p.category === 'car_keyfob').map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => applyPreset(preset)}
                  className="inline-flex items-center px-3 py-1.5 rounded-full text-sm bg-purple-50 hover:bg-purple-100 text-purple-700 transition-colors border border-purple-200"
                  title={preset.description}
                >
                  <Radio className="h-3 w-3 mr-1.5" />
                  {preset.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* TPMS Presets */}
        {presets.filter(p => p.category === 'tpms').length > 0 && (
          <div className="mb-3">
            <div className="text-xs font-medium text-orange-600 mb-2 flex items-center">
              <span className="bg-orange-100 px-2 py-0.5 rounded">TPMS (Tire Pressure)</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {presets.filter(p => p.category === 'tpms').map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => applyPreset(preset)}
                  className="inline-flex items-center px-3 py-1.5 rounded-full text-sm bg-orange-50 hover:bg-orange-100 text-orange-700 transition-colors border border-orange-200"
                  title={preset.description}
                >
                  <Radio className="h-3 w-3 mr-1.5" />
                  {preset.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Other Presets */}
        <div className="mb-2">
          <div className="text-xs font-medium text-gray-600 mb-2 flex items-center">
            <span className="bg-gray-100 px-2 py-0.5 rounded">Other Frequencies</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {presets.filter(p => !p.category || !['car_keyfob', 'tpms'].includes(p.category)).map((preset) => (
              <button
                key={preset.name}
                onClick={() => applyPreset(preset)}
                className="inline-flex items-center px-3 py-1.5 rounded-full text-sm bg-gray-100 hover:bg-blue-100 hover:text-blue-700 transition-colors"
                title={preset.description}
              >
                <Radio className="h-3 w-3 mr-1.5" />
                {preset.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ===== SCAN MODE CONTROLS ===== */}
      {mode === 'scan' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Scan Parameters</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Start Frequency</label>
              <input
                type="text"
                value={startFreq}
                onChange={(e) => setStartFreq(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., 88M"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">End Frequency</label>
              <input
                type="text"
                value={endFreq}
                onChange={(e) => setEndFreq(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., 108M"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Bin Size</label>
              <select
                value={binSize}
                onChange={(e) => setBinSize(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="10k">10 kHz (Fine)</option>
                <option value="25k">25 kHz</option>
                <option value="50k">50 kHz</option>
                <option value="100k">100 kHz</option>
                <option value="500k">500 kHz</option>
                <option value="1M">1 MHz (Fast)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Integration (sec)</label>
              <input
                type="number"
                value={integration}
                onChange={(e) => setIntegration(Number(e.target.value))}
                min={1}
                max={60}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Gain</label>
              <input
                type="range"
                value={gain}
                onChange={(e) => setGain(Number(e.target.value))}
                min={0}
                max={50}
                className="w-full"
              />
              <div className="text-xs text-center text-gray-500">{gain} dB</div>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-4">
            <button
              onClick={startScan}
              disabled={scanning}
              className={`inline-flex items-center px-4 py-2 rounded-md text-sm font-medium text-white ${
                scanning
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {scanning ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Scanning... {Math.round(progress)}%
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Start Scan
                </>
              )}
            </button>

            {scanning && (
              <div className="flex-1 bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
              {error}
            </div>
          )}
        </div>
      )}

      {/* ===== LIVE MODE CONTROLS ===== */}
      {mode === 'live' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          {/* RTL-433 Warning Banner */}
          {rtl433Running && !liveRunning && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between">
              <div className="flex items-center text-amber-800">
                <AlertTriangle className="h-5 w-5 mr-2 text-amber-500" />
                <div>
                  <span className="font-medium">rtl_433 is running</span>
                  <span className="text-sm ml-2 text-amber-600">- Stop it to use Live spectrum mode</span>
                </div>
              </div>
              <button
                onClick={stopRtl433}
                disabled={stoppingRtl433}
                className="inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400"
              >
                {stoppingRtl433 ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-1.5 animate-spin" />
                    Stopping...
                  </>
                ) : (
                  <>
                    <Power className="h-4 w-4 mr-1.5" />
                    Stop rtl_433
                  </>
                )}
              </button>
            </div>
          )}

          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-700 flex items-center">
              <Settings2 className="h-4 w-4 mr-2" />
              Live Spectrum Parameters
            </h3>
            {liveConnected && (
              <span className="flex items-center text-xs text-green-600">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-1.5 animate-pulse"></span>
                Connected
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Center Frequency</label>
              <input
                type="text"
                value={liveCenterFreq}
                onChange={(e) => setLiveCenterFreq(e.target.value)}
                disabled={liveRunning}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 disabled:bg-gray-100"
                placeholder="e.g., 433.92M"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Sample Rate</label>
              <select
                value={liveSampleRate}
                onChange={(e) => setLiveSampleRate(e.target.value)}
                disabled={liveRunning}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 disabled:bg-gray-100"
              >
                <option value="1.024M">1.024 MHz</option>
                <option value="2.048M">2.048 MHz</option>
                <option value="2.4M">2.4 MHz</option>
                <option value="3.2M">3.2 MHz</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">FFT Size</label>
              <select
                value={liveFftSize}
                onChange={(e) => setLiveFftSize(Number(e.target.value))}
                disabled={liveRunning}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 disabled:bg-gray-100"
              >
                <option value={256}>256</option>
                <option value={512}>512</option>
                <option value={1024}>1024</option>
                <option value={2048}>2048</option>
                <option value={4096}>4096</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Averaging</label>
              <input
                type="number"
                value={liveAveraging}
                onChange={(e) => setLiveAveraging(Number(e.target.value))}
                min={1}
                max={16}
                disabled={liveRunning}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 disabled:bg-gray-100"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Gain</label>
              <input
                type="range"
                value={liveGain}
                onChange={(e) => setLiveGain(Number(e.target.value))}
                min={0}
                max={50}
                disabled={liveRunning}
                className="w-full"
              />
              <div className="text-xs text-center text-gray-500">{liveGain} dB</div>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-4">
            {!liveRunning ? (
              <button
                onClick={startLive}
                disabled={rtl433Running}
                className={`inline-flex items-center px-4 py-2 rounded-md text-sm font-medium text-white ${
                  rtl433Running
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-green-600 hover:bg-green-700'
                }`}
                title={rtl433Running ? 'Stop rtl_433 first' : 'Start live spectrum'}
              >
                <Play className="h-4 w-4 mr-2" />
                Start Live
              </button>
            ) : (
              <button
                onClick={async () => {
                  await stopLive()
                  // Offer to restart rtl_433
                }}
                className="inline-flex items-center px-4 py-2 rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700"
              >
                <Square className="h-4 w-4 mr-2" />
                Stop Live
              </button>
            )}

            {/* Restart rtl_433 button after stopping live */}
            {!liveRunning && !rtl433Running && (
              <button
                onClick={startRtl433}
                className="inline-flex items-center px-3 py-2 rounded-md text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 border border-gray-300"
                title="Resume sensor listening"
              >
                <Power className="h-4 w-4 mr-1.5 text-green-600" />
                Start rtl_433
              </button>
            )}

            {liveSpectrum && (
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span>Center: {liveSpectrum.center_freq_mhz.toFixed(3)} MHz</span>
                <span>BW: {liveSpectrum.sample_rate_mhz.toFixed(2)} MHz</span>
                <span>Avg: {liveSpectrum.avg_power.toFixed(1)} dB</span>
              </div>
            )}
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
              {error}
            </div>
          )}
        </div>
      )}

      {/* Spectrum Chart */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <h3 className="text-sm font-medium text-gray-700 mb-3">
          {mode === 'live' ? 'Live Spectrum' : 'Spectrum View'}
          {mode === 'scan' && totalPoints > 0 && (
            <span className="text-gray-400 ml-2">({totalPoints} points)</span>
          )}
          {mode === 'live' && liveRunning && (
            <span className="text-green-500 ml-2 text-xs animate-pulse">LIVE</span>
          )}
        </h3>

        {/* Show appropriate chart based on mode */}
        {mode === 'scan' && spectrum.length === 0 ? (
          <div className="h-[300px] flex items-center justify-center text-gray-400 bg-gray-50 rounded-lg border-2 border-dashed">
            <div className="text-center">
              <Activity className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No spectrum data yet</p>
              <p className="text-sm">Click "Start Scan" to analyze frequencies</p>
            </div>
          </div>
        ) : mode === 'live' && !liveSpectrum ? (
          <div className="h-[300px] flex items-center justify-center text-gray-400 bg-gray-900 rounded-lg border-2 border-dashed border-gray-700">
            <div className="text-center">
              <Wifi className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p className="text-gray-500">No live data</p>
              <p className="text-sm text-gray-600">Click "Start Live" to begin real-time analysis</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <svg
              width={chartWidth}
              height={chartHeight}
              className="bg-gray-900 rounded-lg"
            >
              {/* Grid lines */}
              {[...Array(5)].map((_, i) => (
                <line
                  key={`h-${i}`}
                  x1={padding}
                  y1={padding + (i * (chartHeight - 2 * padding)) / 4}
                  x2={chartWidth - padding}
                  y2={padding + (i * (chartHeight - 2 * padding)) / 4}
                  stroke="#374151"
                  strokeWidth="1"
                />
              ))}

              {/* Spectrum line */}
              <path
                d={mode === 'live' ? getLiveChartPath() : getScanChartPath()}
                fill="none"
                stroke={mode === 'live' ? '#22C55E' : '#10B981'}
                strokeWidth="2"
              />

              {/* Peak markers (scan mode only) */}
              {mode === 'scan' && getPeakMarkers().map((peak, i) => (
                <g key={i}>
                  <circle
                    cx={peak.x}
                    cy={peak.y}
                    r="4"
                    fill="#EF4444"
                  />
                  <text
                    x={peak.x}
                    y={peak.y - 10}
                    fill="#F87171"
                    fontSize="10"
                    textAnchor="middle"
                  >
                    {peak.freq.toFixed(2)}
                  </text>
                </g>
              ))}

              {/* X-axis labels */}
              {mode === 'scan' && spectrum.length > 0 && (
                <>
                  <text
                    x={padding}
                    y={chartHeight - 10}
                    fill="#9CA3AF"
                    fontSize="12"
                  >
                    {spectrum[0].frequency.toFixed(1)} MHz
                  </text>
                  <text
                    x={chartWidth - padding}
                    y={chartHeight - 10}
                    fill="#9CA3AF"
                    fontSize="12"
                    textAnchor="end"
                  >
                    {spectrum[spectrum.length - 1].frequency.toFixed(1)} MHz
                  </text>
                </>
              )}

              {mode === 'live' && liveSpectrum && (
                <>
                  <text
                    x={padding}
                    y={chartHeight - 10}
                    fill="#9CA3AF"
                    fontSize="12"
                  >
                    {liveSpectrum.frequencies[0]?.toFixed(2)} MHz
                  </text>
                  <text
                    x={chartWidth - padding}
                    y={chartHeight - 10}
                    fill="#9CA3AF"
                    fontSize="12"
                    textAnchor="end"
                  >
                    {liveSpectrum.frequencies[liveSpectrum.frequencies.length - 1]?.toFixed(2)} MHz
                  </text>
                </>
              )}

              {/* Y-axis labels */}
              {mode === 'scan' && spectrum.length > 0 && (
                <>
                  <text
                    x={10}
                    y={padding + 5}
                    fill="#9CA3AF"
                    fontSize="10"
                  >
                    {Math.max(...spectrum.map(p => p.power)).toFixed(0)} dB
                  </text>
                  <text
                    x={10}
                    y={chartHeight - padding}
                    fill="#9CA3AF"
                    fontSize="10"
                  >
                    {Math.min(...spectrum.map(p => p.power)).toFixed(0)} dB
                  </text>
                </>
              )}

              {mode === 'live' && liveSpectrum && (
                <>
                  <text
                    x={10}
                    y={padding + 5}
                    fill="#9CA3AF"
                    fontSize="10"
                  >
                    {liveSpectrum.max_power.toFixed(0)} dB
                  </text>
                  <text
                    x={10}
                    y={chartHeight - padding}
                    fill="#9CA3AF"
                    fontSize="10"
                  >
                    {liveSpectrum.min_power.toFixed(0)} dB
                  </text>
                </>
              )}
            </svg>
          </div>
        )}
      </div>

      {/* Live Decode Panel */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {/* Panel Header */}
        <div className="px-4 py-3 flex items-center justify-between bg-gray-50">
          <button
            onClick={() => setShowDecodePanel(!showDecodePanel)}
            className="flex items-center hover:text-purple-700 transition-colors"
          >
            <Signal className="h-4 w-4 mr-2 text-purple-600" />
            <span className="font-medium text-gray-700">Live Decode</span>
            {rtl433Running && decodeConnected && (
              <span className="ml-2 flex items-center text-xs text-green-600">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse"></span>
                Live
              </span>
            )}
            {decodedSignals.length > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">
                {decodedSignals.length}
              </span>
            )}
            {showDecodePanel ? (
              <ChevronUp className="h-4 w-4 ml-2 text-gray-400" />
            ) : (
              <ChevronDown className="h-4 w-4 ml-2 text-gray-400" />
            )}
          </button>

          {/* Stop Listening Button */}
          {rtl433Running && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                stopRtl433()
                setDecodedSignals([])
              }}
              className="inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium text-red-700 bg-red-100 hover:bg-red-200 border border-red-200 transition-colors"
            >
              <Square className="h-3 w-3 mr-1.5" />
              Stop Listening
            </button>
          )}
        </div>

        {/* Panel Content */}
        {showDecodePanel && (
          <div className="border-t border-gray-200">
            {!rtl433Running ? (
              <div className="p-6 text-center text-gray-500">
                <Radio className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="font-medium">rtl_433 not running</p>
                <p className="text-sm mt-1">
                  {liveRunning || scanning
                    ? 'SDR is busy with spectrum analysis'
                    : 'Start rtl_433 to decode signals'}
                </p>
                {!liveRunning && !scanning && (
                  <button
                    onClick={startRtl433}
                    className="mt-3 inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-md text-sm hover:bg-purple-700"
                  >
                    <Power className="h-4 w-4 mr-1.5" />
                    Start Decoder
                  </button>
                )}
              </div>
            ) : decodedSignals.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                <Activity className="h-8 w-8 mx-auto mb-2 opacity-40 animate-pulse" />
                <p>Listening for signals...</p>
                <p className="text-sm mt-1">Decoded signals will appear here</p>
              </div>
            ) : (
              <div className="max-h-[250px] overflow-y-auto">
                <div className="divide-y divide-gray-100">
                  {decodedSignals.map((sig) => (
                    <div
                      key={sig.id}
                      className="px-4 py-2 hover:bg-gray-50 flex items-center justify-between"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900 truncate">
                            {sig.model}
                          </span>
                          {sig.device_id !== undefined && (
                            <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
                              ID: {sig.device_id}
                            </span>
                          )}
                          {sig.channel !== undefined && (
                            <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded">
                              CH{sig.channel}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-sm">
                          {sig.temperature_C !== undefined && (
                            <span className="flex items-center text-orange-600">
                              <Thermometer className="h-3 w-3 mr-0.5" />
                              {sig.temperature_C.toFixed(1)}°C
                            </span>
                          )}
                          {sig.humidity !== undefined && (
                            <span className="flex items-center text-blue-600">
                              <Droplets className="h-3 w-3 mr-0.5" />
                              {sig.humidity}%
                            </span>
                          )}
                          {sig.battery_ok !== undefined && (
                            <span className={`flex items-center ${sig.battery_ok ? 'text-green-600' : 'text-red-600'}`}>
                              <Battery className="h-3 w-3 mr-0.5" />
                              {sig.battery_ok ? 'OK' : 'Low'}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-xs text-gray-400 ml-2 whitespace-nowrap">
                        {new Date(sig.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Detected Peaks (scan mode only) */}
      {mode === 'scan' && peaks.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
            <Zap className="h-4 w-4 mr-2 text-yellow-500" />
            Detected Signals ({peaks.length})
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {peaks.map((peak, i) => (
              <div
                key={i}
                className="bg-gray-50 rounded-lg p-3 border hover:border-blue-300 cursor-pointer transition-colors"
              >
                <div className="text-lg font-bold text-gray-900">
                  {peak.frequency.toFixed(3)} MHz
                </div>
                <div className="text-sm text-gray-500">
                  {peak.power.toFixed(1)} dB
                </div>
                <div className="mt-2 flex gap-1">
                  <button
                    className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                    title="Listen to this frequency"
                  >
                    <Volume2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats (scan mode) */}
      {mode === 'scan' && avgPower !== null && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="text-sm text-gray-500">Average Power</div>
            <div className="text-2xl font-bold text-gray-900">{avgPower} dB</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="text-sm text-gray-500">Peaks Found</div>
            <div className="text-2xl font-bold text-gray-900">{peaks.length}</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="text-sm text-gray-500">Data Points</div>
            <div className="text-2xl font-bold text-gray-900">{totalPoints}</div>
          </div>
        </div>
      )}

      {/* Help */}
      <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
        <h3 className="text-sm font-medium text-blue-800 mb-2">Tips for Finding Signals</h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li><strong>Scan Mode</strong>: Best for surveying a wide range, finding what frequencies are active</li>
          <li><strong>Live Mode</strong>: Best for watching a specific frequency in real-time (keyfob presses, etc.)</li>
          <li><strong>315 MHz</strong>: US car key fobs (Ford, GM, Toyota), garage door openers</li>
          <li><strong>433 MHz</strong>: EU/Asian car remotes, weather sensors, doorbells</li>
          <li><strong>868 MHz</strong>: European car remotes (BMW, Mercedes, Audi)</li>
        </ul>
      </div>

      {/* Security Note */}
      <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
        <h3 className="text-sm font-medium text-yellow-800 mb-2">Important Note</h3>
        <p className="text-sm text-yellow-700">
          Modern car keyfobs use <strong>rolling codes (KeeLoq)</strong> which change with each press.
          You can detect when they transmit, but capturing and replaying signals won't unlock vehicles.
          RTL-SDR is receive-only and cannot transmit. This is for educational/research purposes only.
        </p>
      </div>
    </div>
  )
}
