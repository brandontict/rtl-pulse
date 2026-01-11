import { useEffect, useState, useMemo } from 'react'
import {
  Radio,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  RefreshCw,
  Filter,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Battery,
  BatteryLow,
  Thermometer,
  Droplets,
  Wind,
  Gauge,
  Clock,
  Copy,
  Check,
} from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import { api } from '../services/api'
import type { SensorReading } from '../types'

type SortField = 'time' | 'model' | 'id' | 'temperature_C' | 'humidity' | 'battery_ok'
type SortDirection = 'asc' | 'desc'

interface SortConfig {
  field: SortField
  direction: SortDirection
}

export default function Signals() {
  const [readings, setReadings] = useState<SensorReading[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set())
  const [sortConfig, setSortConfig] = useState<SortConfig>({ field: 'time', direction: 'desc' })
  const [filterModel, setFilterModel] = useState('')
  const [filterSearch, setFilterSearch] = useState('')
  const [hoursRange, setHoursRange] = useState(24)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)

  useEffect(() => {
    loadReadings()
  }, [hoursRange])

  async function loadReadings() {
    try {
      const data = await api.getReadings({ hours: hoursRange, limit: 500 })
      setReadings(data)
    } catch (err) {
      console.error('Failed to load readings:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  async function handleRefresh() {
    setRefreshing(true)
    await loadReadings()
  }

  function toggleRow(index: number) {
    setExpandedRows(prev => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  function handleSort(field: SortField) {
    setSortConfig(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'desc' ? 'asc' : 'desc'
    }))
  }

  async function copyRawData(index: number, data: Record<string, unknown>) {
    try {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2))
      setCopiedIndex(index)
      setTimeout(() => setCopiedIndex(null), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  // Get unique models for filter dropdown
  const uniqueModels = useMemo(() => {
    const models = new Set(readings.map(r => r.model))
    return Array.from(models).sort()
  }, [readings])

  // Filter and sort readings
  const filteredAndSorted = useMemo(() => {
    let result = [...readings]

    // Filter by model
    if (filterModel) {
      result = result.filter(r => r.model === filterModel)
    }

    // Filter by search term
    if (filterSearch) {
      const search = filterSearch.toLowerCase()
      result = result.filter(r =>
        r.model.toLowerCase().includes(search) ||
        String(r.id).includes(search) ||
        JSON.stringify(r.raw_data).toLowerCase().includes(search)
      )
    }

    // Sort
    result.sort((a, b) => {
      let aVal: number | string | null
      let bVal: number | string | null

      switch (sortConfig.field) {
        case 'time':
          aVal = new Date(a.time).getTime()
          bVal = new Date(b.time).getTime()
          break
        case 'model':
          aVal = a.model
          bVal = b.model
          break
        case 'id':
          aVal = String(a.id)
          bVal = String(b.id)
          break
        case 'temperature_C':
          aVal = a.temperature_C ?? -999
          bVal = b.temperature_C ?? -999
          break
        case 'humidity':
          aVal = a.humidity ?? -999
          bVal = b.humidity ?? -999
          break
        case 'battery_ok':
          aVal = a.battery_ok ?? -1
          bVal = b.battery_ok ?? -1
          break
        default:
          return 0
      }

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1
      return 0
    })

    return result
  }, [readings, filterModel, filterSearch, sortConfig])

  function SortIcon({ field }: { field: SortField }) {
    if (sortConfig.field !== field) {
      return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />
    }
    return sortConfig.direction === 'desc'
      ? <ArrowDown className="h-3 w-3 ml-1 text-blue-600" />
      : <ArrowUp className="h-3 w-3 ml-1 text-blue-600" />
  }

  function SortableHeader({ field, children }: { field: SortField; children: React.ReactNode }) {
    return (
      <th
        className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none"
        onClick={() => handleSort(field)}
      >
        <div className="flex items-center">
          {children}
          <SortIcon field={field} />
        </div>
      </th>
    )
  }

  function formatValue(value: number | null | undefined, unit: string, decimals = 1): string {
    if (value === null || value === undefined) return '-'
    return `${value.toFixed(decimals)}${unit}`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Signal Log</h2>
          <p className="text-sm text-gray-500">{filteredAndSorted.length} signals captured</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
        <div className="flex flex-wrap gap-4 items-center">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search signals..."
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Model Filter */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <select
              value={filterModel}
              onChange={(e) => setFilterModel(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Models</option>
              {uniqueModels.map(model => (
                <option key={model} value={model}>{model}</option>
              ))}
            </select>
          </div>

          {/* Time Range */}
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-gray-400" />
            <select
              value={hoursRange}
              onChange={(e) => setHoursRange(Number(e.target.value))}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value={1}>Last 1 hour</option>
              <option value={6}>Last 6 hours</option>
              <option value={12}>Last 12 hours</option>
              <option value={24}>Last 24 hours</option>
              <option value={48}>Last 48 hours</option>
              <option value={168}>Last 7 days</option>
            </select>
          </div>
        </div>
      </div>

      {/* Signals Table */}
      {filteredAndSorted.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 text-center py-12">
          <Radio className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No signals detected yet.</p>
          <p className="text-sm text-gray-400 mt-2">
            Signals will appear here as they are received.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="w-8 px-2"></th>
                  <SortableHeader field="time">Time</SortableHeader>
                  <SortableHeader field="model">Model</SortableHeader>
                  <SortableHeader field="id">ID</SortableHeader>
                  <SortableHeader field="temperature_C">
                    <Thermometer className="h-3 w-3 mr-1" /> Temp
                  </SortableHeader>
                  <SortableHeader field="humidity">
                    <Droplets className="h-3 w-3 mr-1" /> Humidity
                  </SortableHeader>
                  <SortableHeader field="battery_ok">
                    <Battery className="h-3 w-3 mr-1" /> Battery
                  </SortableHeader>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Other</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredAndSorted.map((reading, index) => (
                  <>
                    {/* Main Row */}
                    <tr
                      key={`row-${index}`}
                      className={`hover:bg-gray-50 cursor-pointer ${expandedRows.has(index) ? 'bg-blue-50' : ''}`}
                      onClick={() => toggleRow(index)}
                    >
                      <td className="px-2 py-3">
                        {expandedRows.has(index)
                          ? <ChevronDown className="h-4 w-4 text-gray-400" />
                          : <ChevronRight className="h-4 w-4 text-gray-400" />
                        }
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900">
                          {format(new Date(reading.time), 'HH:mm:ss')}
                        </div>
                        <div className="text-xs text-gray-500">
                          {formatDistanceToNow(new Date(reading.time), { addSuffix: true })}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {reading.model}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {reading.id ?? '-'}
                        {reading.channel !== null && (
                          <span className="text-xs text-gray-400 ml-1">CH{reading.channel}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {reading.temperature_C !== null ? (
                          <span className={reading.temperature_C < 0 ? 'text-blue-600' : reading.temperature_C > 30 ? 'text-red-600' : 'text-gray-900'}>
                            {formatValue(reading.temperature_C, '°C')}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {formatValue(reading.humidity, '%', 0)}
                      </td>
                      <td className="px-4 py-3">
                        {reading.battery_ok !== null ? (
                          reading.battery_ok === 1 ? (
                            <span className="inline-flex items-center text-green-600">
                              <Battery className="h-4 w-4 mr-1" /> OK
                            </span>
                          ) : (
                            <span className="inline-flex items-center text-red-600">
                              <BatteryLow className="h-4 w-4 mr-1" /> Low
                            </span>
                          )
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {reading.pressure_hPa !== null && (
                          <span className="mr-2">
                            <Gauge className="h-3 w-3 inline mr-1" />
                            {reading.pressure_hPa}hPa
                          </span>
                        )}
                        {reading.wind_avg_km_h !== null && (
                          <span className="mr-2">
                            <Wind className="h-3 w-3 inline mr-1" />
                            {reading.wind_avg_km_h}km/h
                          </span>
                        )}
                        {reading.rain_mm !== null && (
                          <span>Rain: {reading.rain_mm}mm</span>
                        )}
                      </td>
                    </tr>

                    {/* Expanded Row - Verbose Info */}
                    {expandedRows.has(index) && (
                      <tr key={`expanded-${index}`} className="bg-gray-50">
                        <td colSpan={8} className="px-4 py-4">
                          <div className="space-y-4">
                            {/* Quick Stats */}
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                              <div className="bg-white rounded-lg p-3 border">
                                <div className="text-xs text-gray-500 uppercase">Model</div>
                                <div className="font-medium text-gray-900">{reading.model}</div>
                              </div>
                              <div className="bg-white rounded-lg p-3 border">
                                <div className="text-xs text-gray-500 uppercase">Device ID</div>
                                <div className="font-medium text-gray-900">{reading.id ?? 'N/A'}</div>
                              </div>
                              <div className="bg-white rounded-lg p-3 border">
                                <div className="text-xs text-gray-500 uppercase">Channel</div>
                                <div className="font-medium text-gray-900">{reading.channel ?? 'N/A'}</div>
                              </div>
                              <div className="bg-white rounded-lg p-3 border">
                                <div className="text-xs text-gray-500 uppercase">Timestamp</div>
                                <div className="font-medium text-gray-900">{format(new Date(reading.time), 'yyyy-MM-dd HH:mm:ss')}</div>
                              </div>
                              {reading.temperature_C !== null && (
                                <div className="bg-white rounded-lg p-3 border">
                                  <div className="text-xs text-gray-500 uppercase">Temperature</div>
                                  <div className="font-medium text-gray-900">
                                    {reading.temperature_C.toFixed(1)}°C / {(reading.temperature_C * 9/5 + 32).toFixed(1)}°F
                                  </div>
                                </div>
                              )}
                              {reading.humidity !== null && (
                                <div className="bg-white rounded-lg p-3 border">
                                  <div className="text-xs text-gray-500 uppercase">Humidity</div>
                                  <div className="font-medium text-gray-900">{reading.humidity}%</div>
                                </div>
                              )}
                            </div>

                            {/* Raw JSON Data */}
                            <div className="bg-white rounded-lg border">
                              <div className="flex items-center justify-between px-4 py-2 border-b bg-gray-100">
                                <span className="text-sm font-medium text-gray-700">Raw Signal Data (JSON)</span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    copyRawData(index, reading.raw_data)
                                  }}
                                  className="inline-flex items-center px-2 py-1 text-xs font-medium text-gray-600 hover:text-gray-900"
                                >
                                  {copiedIndex === index ? (
                                    <>
                                      <Check className="h-3 w-3 mr-1 text-green-600" /> Copied!
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="h-3 w-3 mr-1" /> Copy
                                    </>
                                  )}
                                </button>
                              </div>
                              <pre className="p-4 text-xs text-gray-800 overflow-x-auto font-mono bg-gray-900 text-green-400 rounded-b-lg">
                                {JSON.stringify(reading.raw_data, null, 2)}
                              </pre>
                            </div>

                            {/* All Fields */}
                            <div className="bg-white rounded-lg border">
                              <div className="px-4 py-2 border-b bg-gray-100">
                                <span className="text-sm font-medium text-gray-700">All Signal Fields</span>
                              </div>
                              <div className="p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 text-sm">
                                {Object.entries(reading.raw_data).map(([key, value]) => (
                                  <div key={key} className="flex justify-between border-b border-gray-100 pb-1">
                                    <span className="text-gray-500 font-mono text-xs">{key}:</span>
                                    <span className="font-medium text-gray-900 ml-2 text-right">
                                      {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
