import { useEffect, useState } from 'react'
import { Radio, Edit2, Check, X, Trash2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { api } from '../services/api'
import type { Device } from '../types'

export default function Devices() {
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  useEffect(() => {
    loadDevices()
  }, [])

  async function loadDevices() {
    try {
      const data = await api.getDevices()
      setDevices(data)
    } catch (err) {
      console.error('Failed to load devices:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveName(deviceId: string) {
    try {
      await api.updateDevice(deviceId, { name: editName })
      setDevices((prev) =>
        prev.map((d) => (d.device_id === deviceId ? { ...d, name: editName } : d))
      )
      setEditingId(null)
    } catch (err) {
      console.error('Failed to update device:', err)
    }
  }

  async function handleToggleEnabled(device: Device) {
    try {
      await api.updateDevice(device.device_id, { enabled: !device.enabled })
      setDevices((prev) =>
        prev.map((d) => (d.device_id === device.device_id ? { ...d, enabled: !d.enabled } : d))
      )
    } catch (err) {
      console.error('Failed to toggle device:', err)
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
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Detected Devices</h2>
        <span className="text-sm text-gray-500">{devices.length} devices</span>
      </div>

      {devices.length === 0 ? (
        <div className="card text-center py-12">
          <Radio className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No devices detected yet.</p>
          <p className="text-sm text-gray-400 mt-2">
            Devices will appear here when they transmit data.
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Device</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Model</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Channel</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Readings</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Seen</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {devices.map((device) => (
                <tr key={device.device_id} className={!device.enabled ? 'bg-gray-50 opacity-60' : ''}>
                  <td className="px-4 py-3">
                    {editingId === device.device_id ? (
                      <div className="flex items-center space-x-2">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="text-sm border rounded px-2 py-1"
                          autoFocus
                        />
                        <button
                          onClick={() => handleSaveName(device.device_id)}
                          className="text-green-500 hover:text-green-700"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {device.name || device.device_id}
                        </p>
                        <p className="text-xs text-gray-500">{device.device_id}</p>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{device.model}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{device.channel || '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{device.reading_count}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {formatDistanceToNow(new Date(device.last_seen), { addSuffix: true })}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        device.enabled
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {device.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={() => {
                          setEditingId(device.device_id)
                          setEditName(device.name || '')
                        }}
                        className="text-gray-400 hover:text-gray-600"
                        title="Edit name"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleToggleEnabled(device)}
                        className="text-gray-400 hover:text-gray-600"
                        title={device.enabled ? 'Disable' : 'Enable'}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
