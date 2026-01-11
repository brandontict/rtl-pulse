import { Thermometer, Droplets, Battery, BatteryWarning } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import type { SensorReading } from '../types'

interface SensorCardProps {
  deviceId: string
  deviceName?: string
  reading: SensorReading
}

export function SensorCard({ deviceId, deviceName, reading }: SensorCardProps) {
  const lastUpdate = reading.time ? formatDistanceToNow(new Date(reading.time), { addSuffix: true }) : 'Unknown'
  const batteryLow = reading.battery_ok === 0

  return (
    <div className="card">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-semibold text-gray-900">{deviceName || reading.model}</h3>
          <p className="text-sm text-gray-500">{deviceId}</p>
        </div>
        {reading.battery_ok !== null && (
          <div className={`flex items-center ${batteryLow ? 'text-red-500' : 'text-green-500'}`}>
            {batteryLow ? <BatteryWarning className="h-5 w-5" /> : <Battery className="h-5 w-5" />}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {reading.temperature_C !== null && (
          <div className="flex items-center space-x-2">
            <Thermometer className="h-5 w-5 text-orange-500" />
            <div>
              <p className="text-2xl font-bold text-gray-900">{reading.temperature_C.toFixed(1)}°C</p>
              <p className="text-xs text-gray-500">Temperature</p>
            </div>
          </div>
        )}

        {reading.humidity !== null && (
          <div className="flex items-center space-x-2">
            <Droplets className="h-5 w-5 text-blue-500" />
            <div>
              <p className="text-2xl font-bold text-gray-900">{reading.humidity.toFixed(0)}%</p>
              <p className="text-xs text-gray-500">Humidity</p>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-gray-100">
        <p className="text-xs text-gray-400">Updated {lastUpdate}</p>
      </div>
    </div>
  )
}
