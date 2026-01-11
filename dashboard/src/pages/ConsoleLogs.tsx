import { useEffect, useState, useRef } from 'react'
import {
  Terminal,
  RefreshCw,
  Trash2,
  Search,
  Filter,
  Download,
  Pause,
  Play,
  ChevronDown,
  AlertCircle,
  AlertTriangle,
  Info,
  Radio,
  FileText,
} from 'lucide-react'

interface LogEntry {
  source: string
  raw: string
  timestamp: string | null
  level: 'info' | 'warning' | 'error' | 'debug' | 'signal'
  is_json: boolean
}

interface LogFile {
  name: string
  filename: string
  size: number
  modified: string
}

const API_BASE = '/api/v1'

export default function ConsoleLogs() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [logFiles, setLogFiles] = useState<LogFile[]>([])
  const [loading, setLoading] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [refreshInterval, setRefreshInterval] = useState(3000)
  const [selectedSource, setSelectedSource] = useState('all')
  const [selectedLevel, setSelectedLevel] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [lineCount, setLineCount] = useState(200)
  const logsEndRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)

  useEffect(() => {
    loadLogs()
    loadLogFiles()
  }, [selectedSource, lineCount])

  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(() => {
      loadLogs()
    }, refreshInterval)

    return () => clearInterval(interval)
  }, [autoRefresh, refreshInterval, selectedSource, lineCount])

  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs, autoScroll])

  async function loadLogs() {
    try {
      const params = new URLSearchParams({
        log_type: selectedSource,
        lines: lineCount.toString(),
      })
      if (searchTerm) {
        params.set('search', searchTerm)
      }

      const response = await fetch(`${API_BASE}/system/logs?${params}`)
      const data = await response.json()
      setLogs(data.logs || [])
    } catch (err) {
      console.error('Failed to load logs:', err)
    } finally {
      setLoading(false)
    }
  }

  async function loadLogFiles() {
    try {
      const response = await fetch(`${API_BASE}/system/logs/files`)
      const data = await response.json()
      setLogFiles(data.files || [])
    } catch (err) {
      console.error('Failed to load log files:', err)
    }
  }

  async function clearLog(logName: string) {
    if (!confirm(`Clear ${logName}.log?`)) return

    try {
      await fetch(`${API_BASE}/system/logs/${logName}`, { method: 'DELETE' })
      loadLogs()
      loadLogFiles()
    } catch (err) {
      console.error('Failed to clear log:', err)
    }
  }

  function downloadLogs() {
    const content = logs.map(l => l.raw).join('\n')
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `rtl-sdr-logs-${new Date().toISOString().slice(0, 10)}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
  }

  function getLevelIcon(level: string) {
    switch (level) {
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      case 'signal':
        return <Radio className="h-4 w-4 text-green-500" />
      case 'debug':
        return <FileText className="h-4 w-4 text-gray-400" />
      default:
        return <Info className="h-4 w-4 text-blue-500" />
    }
  }

  function getLevelClass(level: string): string {
    switch (level) {
      case 'error':
        return 'bg-red-900/30 border-red-800 text-red-300'
      case 'warning':
        return 'bg-yellow-900/30 border-yellow-800 text-yellow-300'
      case 'signal':
        return 'bg-green-900/30 border-green-800 text-green-300'
      case 'debug':
        return 'bg-gray-800/50 border-gray-700 text-gray-400'
      default:
        return 'bg-gray-800/30 border-gray-700 text-gray-300'
    }
  }

  function getSourceClass(source: string): string {
    const colors: Record<string, string> = {
      rtl_433: 'bg-purple-600',
      backend: 'bg-blue-600',
      dashboard: 'bg-green-600',
      analyzer: 'bg-orange-600',
    }
    return colors[source] || 'bg-gray-600'
  }

  // Filter logs by level
  const filteredLogs = logs.filter(log => {
    if (selectedLevel === 'all') return true
    return log.level === selectedLevel
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 flex items-center">
            <Terminal className="h-5 w-5 mr-2" />
            Console Logs
          </h2>
          <p className="text-sm text-gray-500">{filteredLogs.length} entries</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`inline-flex items-center px-3 py-2 border rounded-md text-sm font-medium ${
              autoRefresh
                ? 'border-green-500 text-green-700 bg-green-50'
                : 'border-gray-300 text-gray-700 bg-white'
            }`}
          >
            {autoRefresh ? (
              <>
                <Pause className="h-4 w-4 mr-1" /> Live
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-1" /> Paused
              </>
            )}
          </button>

          <button
            onClick={loadLogs}
            className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </button>

          <button
            onClick={downloadLogs}
            className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <Download className="h-4 w-4 mr-1" />
            Export
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex flex-wrap gap-4 items-center">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadLogs()}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Source Filter */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <select
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Sources</option>
              <option value="rtl_433">rtl_433</option>
              <option value="backend">Backend</option>
              <option value="dashboard">Dashboard</option>
              <option value="analyzer">Analyzer</option>
            </select>
          </div>

          {/* Level Filter */}
          <select
            value={selectedLevel}
            onChange={(e) => setSelectedLevel(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Levels</option>
            <option value="signal">Signals Only</option>
            <option value="error">Errors</option>
            <option value="warning">Warnings</option>
            <option value="info">Info</option>
            <option value="debug">Debug</option>
          </select>

          {/* Line Count */}
          <select
            value={lineCount}
            onChange={(e) => setLineCount(Number(e.target.value))}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value={50}>50 lines</option>
            <option value={100}>100 lines</option>
            <option value={200}>200 lines</option>
            <option value={500}>500 lines</option>
            <option value={1000}>1000 lines</option>
          </select>

          {/* Auto Scroll Toggle */}
          <label className="inline-flex items-center text-sm">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-2"
            />
            Auto-scroll
          </label>
        </div>
      </div>

      {/* Log Files Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {logFiles.map((file) => (
          <div key={file.name} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-gray-900">{file.name}</div>
                <div className="text-sm text-gray-500">{formatBytes(file.size)}</div>
              </div>
              <button
                onClick={() => clearLog(file.name)}
                className="text-gray-400 hover:text-red-600"
                title="Clear log"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Log Console */}
      <div className="bg-gray-900 rounded-lg shadow-lg overflow-hidden border border-gray-700">
        <div className="bg-gray-800 px-4 py-2 flex items-center justify-between border-b border-gray-700">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
            </div>
            <span className="text-gray-400 text-sm ml-2">RTL-SDR Console</span>
          </div>
          <div className="text-xs text-gray-500">
            {autoRefresh && <span className="text-green-400 mr-2">● LIVE</span>}
            {filteredLogs.length} entries
          </div>
        </div>

        <div className="h-[500px] overflow-y-auto p-4 font-mono text-sm space-y-1">
          {filteredLogs.length === 0 ? (
            <div className="text-gray-500 text-center py-8">
              No log entries found
            </div>
          ) : (
            filteredLogs.map((log, index) => (
              <div
                key={index}
                className={`p-2 rounded border ${getLevelClass(log.level)} transition-colors`}
              >
                <div className="flex items-start gap-2">
                  {getLevelIcon(log.level)}
                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium text-white ${getSourceClass(log.source)}`}>
                    {log.source}
                  </span>
                  <span className="flex-1 break-all whitespace-pre-wrap">
                    {log.is_json ? (
                      <code className="text-green-400">{log.raw}</code>
                    ) : (
                      log.raw
                    )}
                  </span>
                </div>
              </div>
            ))
          )}
          <div ref={logsEndRef} />
        </div>
      </div>
    </div>
  )
}
