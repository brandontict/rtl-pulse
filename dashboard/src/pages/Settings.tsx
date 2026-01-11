import { useEffect, useState } from 'react'
import { Play, Square, RefreshCw, Server, Radio, Wifi } from 'lucide-react'
import { api } from '../services/api'
import type { SystemConfig, SystemStatus } from '../types'

export default function SettingsPage() {
  const [config, setConfig] = useState<SystemConfig | null>(null)
  const [status, setStatus] = useState<SystemStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const [configData, statusData] = await Promise.all([
        api.getConfig(),
        api.getStatus(),
      ])
      setConfig(configData)
      setStatus(statusData)
    } catch (err) {
      console.error('Failed to load settings:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleRtl433Action(action: 'start' | 'stop' | 'restart') {
    setActionLoading(`rtl433-${action}`)
    try {
      if (action === 'start') await api.startRtl433()
      else if (action === 'stop') await api.stopRtl433()
      else await api.restartRtl433()

      await loadData()
    } catch (err) {
      console.error(`Failed to ${action} rtl_433:`, err)
    } finally {
      setActionLoading(null)
    }
  }

  async function handleMqttAction(action: 'connect' | 'disconnect') {
    setActionLoading(`mqtt-${action}`)
    try {
      if (action === 'connect') await api.connectMqtt()
      else await api.disconnectMqtt()

      await loadData()
    } catch (err) {
      console.error(`Failed to ${action} MQTT:`, err)
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900">Settings</h2>

      {/* RTL-433 Control */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <Radio className="h-6 w-6 text-primary-600" />
            <div>
              <h3 className="font-semibold text-gray-900">RTL-433</h3>
              <p className="text-sm text-gray-500">Signal receiver and decoder</p>
            </div>
          </div>
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              status?.rtl433_running
                ? 'bg-green-100 text-green-800'
                : 'bg-gray-100 text-gray-800'
            }`}
          >
            {status?.rtl433_running ? 'Running' : 'Stopped'}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-4">
          <div>
            <p className="text-xs text-gray-500">Frequency</p>
            <p className="text-sm font-medium">{config?.rtl433.frequency}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Sample Rate</p>
            <p className="text-sm font-medium">{config?.rtl433.sample_rate}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Gain</p>
            <p className="text-sm font-medium">{config?.rtl433.gain} dB</p>
          </div>
        </div>

        <div className="flex space-x-2">
          <button
            onClick={() => handleRtl433Action('start')}
            disabled={status?.rtl433_running || actionLoading !== null}
            className="btn btn-primary flex items-center space-x-2 disabled:opacity-50"
          >
            <Play className="h-4 w-4" />
            <span>Start</span>
          </button>
          <button
            onClick={() => handleRtl433Action('stop')}
            disabled={!status?.rtl433_running || actionLoading !== null}
            className="btn btn-secondary flex items-center space-x-2 disabled:opacity-50"
          >
            <Square className="h-4 w-4" />
            <span>Stop</span>
          </button>
          <button
            onClick={() => handleRtl433Action('restart')}
            disabled={actionLoading !== null}
            className="btn btn-secondary flex items-center space-x-2 disabled:opacity-50"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Restart</span>
          </button>
        </div>
      </div>

      {/* MQTT Control */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <Server className="h-6 w-6 text-primary-600" />
            <div>
              <h3 className="font-semibold text-gray-900">MQTT</h3>
              <p className="text-sm text-gray-500">Home Assistant integration</p>
            </div>
          </div>
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              status?.mqtt_connected
                ? 'bg-green-100 text-green-800'
                : 'bg-gray-100 text-gray-800'
            }`}
          >
            {status?.mqtt_connected ? 'Connected' : 'Disconnected'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-xs text-gray-500">Broker</p>
            <p className="text-sm font-medium">{config?.mqtt.broker}:{config?.mqtt.port}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Topic Prefix</p>
            <p className="text-sm font-medium">{config?.mqtt.topic_prefix}</p>
          </div>
        </div>

        <div className="flex space-x-2">
          <button
            onClick={() => handleMqttAction('connect')}
            disabled={status?.mqtt_connected || actionLoading !== null}
            className="btn btn-primary flex items-center space-x-2 disabled:opacity-50"
          >
            <Wifi className="h-4 w-4" />
            <span>Connect</span>
          </button>
          <button
            onClick={() => handleMqttAction('disconnect')}
            disabled={!status?.mqtt_connected || actionLoading !== null}
            className="btn btn-secondary flex items-center space-x-2 disabled:opacity-50"
          >
            <span>Disconnect</span>
          </button>
        </div>
      </div>

      {/* Home Assistant */}
      <div className="card">
        <div className="flex items-center space-x-3 mb-4">
          <div className="h-6 w-6 bg-blue-500 rounded flex items-center justify-center">
            <span className="text-white text-xs font-bold">HA</span>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Home Assistant</h3>
            <p className="text-sm text-gray-500">MQTT auto-discovery</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-500">Discovery Prefix</p>
            <p className="text-sm font-medium">{config?.home_assistant.discovery_prefix}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Device Name</p>
            <p className="text-sm font-medium">{config?.home_assistant.device_name}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
