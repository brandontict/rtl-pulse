import { useEffect, useState, useCallback } from 'react'
import { SensorCard } from '../components/SensorCard'
import { LiveChart } from '../components/LiveChart'
import { StatusBar } from '../components/StatusBar'
import { useWebSocket } from '../hooks/useWebSocket'
import { api } from '../services/api'
import type { SensorReading, SystemStatus } from '../types'

export default function Dashboard() {
  const [latestReadings, setLatestReadings] = useState<Record<string, SensorReading>>({})
  const [recentReadings, setRecentReadings] = useState<SensorReading[]>([])
  const [status, setStatus] = useState<SystemStatus | null>(null)
  const [loading, setLoading] = useState(true)

  const handleReading = useCallback((reading: SensorReading) => {
    const deviceId = `${reading.model}_${reading.id}${reading.channel ? `_${reading.channel}` : ''}`

    setLatestReadings((prev) => ({
      ...prev,
      [deviceId]: reading,
    }))

    setRecentReadings((prev) => [reading, ...prev.slice(0, 99)])
  }, [])

  const { connected } = useWebSocket({
    onReading: handleReading,
  })

  useEffect(() => {
    async function fetchData() {
      try {
        const [latest, readings, systemStatus] = await Promise.all([
          api.getLatestReadings(),
          api.getReadings({ hours: 6, limit: 100 }),
          api.getStatus(),
        ])

        setLatestReadings(latest)
        setRecentReadings(readings)
        setStatus(systemStatus)
      } catch (err) {
        console.error('Failed to fetch data:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
    const interval = setInterval(() => api.getStatus().then(setStatus), 30000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  const deviceIds = Object.keys(latestReadings)

  return (
    <div>
      <StatusBar status={status} wsConnected={connected} />

      <h2 className="text-lg font-semibold text-gray-900 mb-4">Live Sensors</h2>

      {deviceIds.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-500">No sensors detected yet.</p>
          <p className="text-sm text-gray-400 mt-2">
            Make sure RTL-433 is running and sensors are transmitting.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {deviceIds.map((deviceId) => (
            <SensorCard
              key={deviceId}
              deviceId={deviceId}
              reading={latestReadings[deviceId]}
            />
          ))}
        </div>
      )}

      {recentReadings.length > 0 && <LiveChart readings={recentReadings} />}
    </div>
  )
}
