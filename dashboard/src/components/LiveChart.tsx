import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { format } from 'date-fns'
import type { SensorReading } from '../types'

interface LiveChartProps {
  readings: SensorReading[]
  showTemperature?: boolean
  showHumidity?: boolean
}

export function LiveChart({ readings, showTemperature = true, showHumidity = true }: LiveChartProps) {
  const chartData = readings
    .slice()
    .reverse()
    .map((r) => ({
      time: new Date(r.time).getTime(),
      temperature: r.temperature_C,
      humidity: r.humidity,
    }))

  const formatXAxis = (tickItem: number) => {
    return format(new Date(tickItem), 'HH:mm')
  }

  return (
    <div className="card h-80">
      <h3 className="font-semibold text-gray-900 mb-4">Sensor History</h3>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 25 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="time"
            tickFormatter={formatXAxis}
            stroke="#9ca3af"
            fontSize={12}
          />
          <YAxis yAxisId="temp" stroke="#f97316" fontSize={12} />
          {showHumidity && (
            <YAxis yAxisId="humidity" orientation="right" stroke="#3b82f6" fontSize={12} />
          )}
          <Tooltip
            labelFormatter={(value) => format(new Date(value), 'HH:mm:ss')}
            contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb' }}
          />
          <Legend />
          {showTemperature && (
            <Line
              yAxisId="temp"
              type="monotone"
              dataKey="temperature"
              stroke="#f97316"
              strokeWidth={2}
              dot={false}
              name="Temperature (°C)"
            />
          )}
          {showHumidity && (
            <Line
              yAxisId="humidity"
              type="monotone"
              dataKey="humidity"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
              name="Humidity (%)"
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
