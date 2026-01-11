export interface SensorReading {
  time: string
  model: string
  id: string | number | null
  channel: number | null
  battery_ok: number | null
  temperature_C: number | null
  humidity: number | null
  pressure_hPa: number | null
  wind_avg_km_h: number | null
  wind_max_km_h: number | null
  wind_dir_deg: number | null
  rain_mm: number | null
  raw_data: Record<string, unknown>
}

export interface Device {
  model: string
  device_id: string
  name: string | null
  channel: number | null
  first_seen: string
  last_seen: string
  reading_count: number
  battery_ok: boolean | null
  enabled: boolean
}

export interface SystemStatus {
  rtl433_running: boolean
  mqtt_connected: boolean
  active_devices: number
  total_readings: number
  uptime_seconds: number
  last_reading: string | null
}

export interface WebSocketMessage {
  type: 'reading' | 'device' | 'status' | 'error' | 'heartbeat' | 'pong'
  data: unknown
  timestamp: string
}

export interface SystemConfig {
  rtl433: {
    frequency: string
    sample_rate: string
    gain: number
    binary_exists: boolean
    config_exists: boolean
  }
  mqtt: {
    broker: string
    port: number
    connected: boolean
    topic_prefix: string
  }
  websocket: {
    active_connections: number
  }
  home_assistant: {
    discovery_prefix: string
    device_name: string
  }
}

export interface Protocol {
  id: number
  name: string
  category: string
  desc: string
}

export interface ProtocolCategory {
  id: string
  name: string
  count: number
}

export interface ProgramFlag {
  flag: string
  name: string
  type: 'text' | 'number' | 'boolean' | 'select' | 'multiselect' | 'protocol'
  default: unknown
  desc: string
  min?: number
  max?: number
  options?: string[]
  examples?: string[]
}

export interface Frequency {
  frequency: string
  region: string
  common_uses: string
}
