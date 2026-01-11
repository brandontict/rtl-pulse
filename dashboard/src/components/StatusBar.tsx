import { Wifi, WifiOff, Radio, Server, Clock } from 'lucide-react'
import type { SystemStatus } from '../types'

interface StatusBarProps {
  status: SystemStatus | null
  wsConnected: boolean
}

export function StatusBar({ status, wsConnected }: StatusBarProps) {
  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return `${hours}h ${minutes}m`
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 mb-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center space-x-6">
          {/* WebSocket Status */}
          <div className="flex items-center space-x-2">
            {wsConnected ? (
              <Wifi className="h-4 w-4 text-green-500" />
            ) : (
              <WifiOff className="h-4 w-4 text-red-500" />
            )}
            <span className="text-sm text-gray-600">
              {wsConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>

          {/* RTL-433 Status */}
          <div className="flex items-center space-x-2">
            <Radio className={`h-4 w-4 ${status?.rtl433_running ? 'text-green-500' : 'text-gray-400'}`} />
            <span className="text-sm text-gray-600">
              RTL-433: {status?.rtl433_running ? 'Running' : 'Stopped'}
            </span>
          </div>

          {/* MQTT Status */}
          <div className="flex items-center space-x-2">
            <Server className={`h-4 w-4 ${status?.mqtt_connected ? 'text-green-500' : 'text-gray-400'}`} />
            <span className="text-sm text-gray-600">
              MQTT: {status?.mqtt_connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-6 text-sm text-gray-500">
          <span>{status?.active_devices || 0} devices</span>
          <span>{status?.total_readings || 0} readings</span>
          {status && (
            <div className="flex items-center space-x-1">
              <Clock className="h-4 w-4" />
              <span>Uptime: {formatUptime(status.uptime_seconds)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
