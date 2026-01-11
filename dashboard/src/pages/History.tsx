import { useEffect, useState } from 'react'
import { LiveChart } from '../components/LiveChart'
import { api } from '../services/api'
import type { SensorReading, Device } from '../types'

export default function HistoryPage() {
  const [devices, setDevices] = useState<Device[]>([])
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null)
  const [readings, setReadings] = useState<SensorReading[]>([])
  const [hours, setHours] = useState(24)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getDevices(true).then((data) => {
      setDevices(data)
      if (data.length > 0 && !selectedDevice) {
        setSelectedDevice(data[0].device_id)
      }
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (!selectedDevice) return

    setLoading(true)
    api.getDeviceHistory(selectedDevice, hours).then((data) => {
      setReadings(data.readings)
      setLoading(false)
    })
  }, [selectedDevice, hours])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Sensor History</h2>

        <div className="flex items-center space-x-4">
          <select
            value={selectedDevice || ''}
            onChange={(e) => setSelectedDevice(e.target.value)}
            className="rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
          >
            {devices.map((device) => (
              <option key={device.device_id} value={device.device_id}>
                {device.name || device.model} ({device.device_id})
              </option>
            ))}
          </select>

          <select
            value={hours}
            onChange={(e) => setHours(parseInt(e.target.value))}
            className="rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
          >
            <option value={6}>Last 6 hours</option>
            <option value={12}>Last 12 hours</option>
            <option value={24}>Last 24 hours</option>
            <option value={48}>Last 2 days</option>
            <option value={168}>Last week</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : readings.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-500">No history data available for this device.</p>
        </div>
      ) : (
        <LiveChart readings={readings} />
      )}

      {readings.length > 0 && (
        <div className="card mt-6">
          <h3 className="font-semibold text-gray-900 mb-4">Recent Readings</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Temperature</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Humidity</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Battery</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {readings.slice(0, 20).map((reading, idx) => (
                  <tr key={idx}>
                    <td className="px-4 py-2 text-sm text-gray-900">
                      {new Date(reading.time).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-900">
                      {reading.temperature_C?.toFixed(1)}°C
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-900">
                      {reading.humidity?.toFixed(0)}%
                    </td>
                    <td className="px-4 py-2 text-sm">
                      <span className={reading.battery_ok === 0 ? 'text-red-500' : 'text-green-500'}>
                        {reading.battery_ok === null ? '-' : reading.battery_ok ? 'OK' : 'Low'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
