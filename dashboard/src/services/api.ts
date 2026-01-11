import type { SensorReading, Device, SystemStatus, SystemConfig, Protocol, ProtocolCategory, ProgramFlag, Frequency } from '../types'

const API_BASE = '/api/v1'

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  })

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

export const api = {
  // Sensors
  getReadings: (params?: { device_id?: string; hours?: number; limit?: number }) => {
    const searchParams = new URLSearchParams()
    if (params?.device_id) searchParams.set('device_id', params.device_id)
    if (params?.hours) searchParams.set('hours', params.hours.toString())
    if (params?.limit) searchParams.set('limit', params.limit.toString())

    const query = searchParams.toString()
    return fetchJson<SensorReading[]>(`/sensors/${query ? `?${query}` : ''}`)
  },

  getLatestReadings: () => fetchJson<Record<string, SensorReading>>('/sensors/latest'),

  getDeviceHistory: (deviceId: string, hours = 24) =>
    fetchJson<{ device_id: string; readings: SensorReading[]; count: number }>(
      `/sensors/history/${deviceId}?hours=${hours}`
    ),

  // Devices
  getDevices: (enabledOnly = false) =>
    fetchJson<Device[]>(`/devices/?enabled_only=${enabledOnly}`),

  getDevice: (deviceId: string) => fetchJson<Device>(`/devices/${deviceId}`),

  updateDevice: (deviceId: string, data: { name?: string; enabled?: boolean }) =>
    fetchJson<Device>(`/devices/${deviceId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  disableDevice: (deviceId: string) =>
    fetchJson<{ message: string }>(`/devices/${deviceId}`, { method: 'DELETE' }),

  // System
  getStatus: () => fetchJson<SystemStatus>('/system/status'),

  getConfig: () => fetchJson<SystemConfig>('/system/config'),

  startRtl433: () => fetchJson<{ status: string; message: string }>('/system/rtl433/start', { method: 'POST' }),

  stopRtl433: () => fetchJson<{ status: string; message: string }>('/system/rtl433/stop', { method: 'POST' }),

  restartRtl433: () => fetchJson<{ status: string; message: string }>('/system/rtl433/restart', { method: 'POST' }),

  connectMqtt: () => fetchJson<{ status: string; message: string }>('/system/mqtt/connect', { method: 'POST' }),

  disconnectMqtt: () => fetchJson<{ status: string; message: string }>('/system/mqtt/disconnect', { method: 'POST' }),

  // Signals & Protocols
  analyzeSignals: (duration = 10) =>
    fetchJson<{ duration: number; signals_detected: number; signals: unknown[] }>(
      `/signals/analyze?duration=${duration}`,
      { method: 'POST' }
    ),

  getProtocols: (params?: { category?: string; search?: string }) => {
    const searchParams = new URLSearchParams()
    if (params?.category) searchParams.set('category', params.category)
    if (params?.search) searchParams.set('search', params.search)
    const query = searchParams.toString()
    return fetchJson<{ protocols: Protocol[]; count: number; total: number }>(
      `/signals/protocols${query ? `?${query}` : ''}`
    )
  },

  getProtocolCategories: () =>
    fetchJson<{ categories: ProtocolCategory[] }>('/signals/protocols/categories'),

  getProtocolsGrouped: () =>
    fetchJson<{
      categories: Record<string, string>
      protocols: Record<string, Protocol[]>
      total: number
    }>('/signals/protocols/grouped'),

  getFlags: () =>
    fetchJson<{ flags: ProgramFlag[]; count: number }>('/signals/flags'),

  getFrequencies: () =>
    fetchJson<{ frequencies: Frequency[]; count: number }>('/signals/frequencies'),

  generateConfig: (params: {
    protocols?: number[]
    frequency?: string
    sample_rate?: string
    gain?: number
    output_json?: boolean
    output_mqtt?: boolean
    mqtt_host?: string
  }) => {
    const searchParams = new URLSearchParams()
    if (params.protocols?.length) {
      params.protocols.forEach(p => searchParams.append('protocols', p.toString()))
    }
    if (params.frequency) searchParams.set('frequency', params.frequency)
    if (params.sample_rate) searchParams.set('sample_rate', params.sample_rate)
    if (params.gain !== undefined) searchParams.set('gain', params.gain.toString())
    if (params.output_json !== undefined) searchParams.set('output_json', params.output_json.toString())
    if (params.output_mqtt !== undefined) searchParams.set('output_mqtt', params.output_mqtt.toString())
    if (params.mqtt_host) searchParams.set('mqtt_host', params.mqtt_host)

    return fetchJson<{ config: string; protocols_enabled: number }>(
      `/signals/config/generate?${searchParams.toString()}`,
      { method: 'POST' }
    )
  },
}
