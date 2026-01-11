import { useState, useRef, useEffect } from 'react'
import {
  Radio,
  ChevronLeft,
  ChevronRight,
  SkipBack,
  SkipForward,
  Volume2,
  Play,
  Square,
  Bookmark,
} from 'lucide-react'

interface Preset {
  name: string
  frequency: number // in MHz
  category?: string
}

interface FrequencyTunerProps {
  frequency: number // in MHz
  onFrequencyChange: (freq: number) => void
  minFreq?: number
  maxFreq?: number
  step?: number
  presets?: Preset[]
  isPlaying?: boolean
  onPlayStop?: () => void
  onPresetSelect?: (preset: Preset) => void
}

export default function FrequencyTuner({
  frequency,
  onFrequencyChange,
  minFreq = 24,
  maxFreq = 1700,
  step = 0.1,
  presets = [],
  isPlaying = false,
  onPlayStop,
  onPresetSelect,
}: FrequencyTunerProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [inputValue, setInputValue] = useState(frequency.toFixed(3))
  const dialRef = useRef<HTMLDivElement>(null)
  const lastWheelTime = useRef(0)

  useEffect(() => {
    setInputValue(frequency.toFixed(3))
  }, [frequency])

  // Handle wheel scroll on dial
  function handleWheel(e: React.WheelEvent) {
    e.preventDefault()
    const now = Date.now()
    if (now - lastWheelTime.current < 50) return // Throttle
    lastWheelTime.current = now

    const delta = e.deltaY > 0 ? -step : step
    const newFreq = Math.max(minFreq, Math.min(maxFreq, frequency + delta))
    onFrequencyChange(newFreq)
  }

  // Fine tune buttons
  function nudgeFrequency(amount: number) {
    const newFreq = Math.max(minFreq, Math.min(maxFreq, frequency + amount))
    onFrequencyChange(newFreq)
  }

  // Jump to preset
  function jumpToPreset(direction: 'prev' | 'next') {
    if (presets.length === 0) return

    const sortedPresets = [...presets].sort((a, b) => a.frequency - b.frequency)

    if (direction === 'next') {
      const next = sortedPresets.find(p => p.frequency > frequency + 0.001)
      if (next) {
        onFrequencyChange(next.frequency)
        onPresetSelect?.(next)
      } else {
        // Wrap to first
        onFrequencyChange(sortedPresets[0].frequency)
        onPresetSelect?.(sortedPresets[0])
      }
    } else {
      const prev = sortedPresets.reverse().find(p => p.frequency < frequency - 0.001)
      if (prev) {
        onFrequencyChange(prev.frequency)
        onPresetSelect?.(prev)
      } else {
        // Wrap to last
        const last = sortedPresets[0]
        onFrequencyChange(last.frequency)
        onPresetSelect?.(last)
      }
    }
  }

  // Handle direct input
  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setInputValue(e.target.value)
  }

  function handleInputBlur() {
    const parsed = parseFloat(inputValue)
    if (!isNaN(parsed) && parsed >= minFreq && parsed <= maxFreq) {
      onFrequencyChange(parsed)
    } else {
      setInputValue(frequency.toFixed(3))
    }
  }

  function handleInputKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      handleInputBlur()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      nudgeFrequency(step)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      nudgeFrequency(-step)
    }
  }

  // Calculate dial position (0-100%)
  const dialPosition = ((frequency - minFreq) / (maxFreq - minFreq)) * 100

  // Find current/nearby presets
  const currentPreset = presets.find(p => Math.abs(p.frequency - frequency) < 0.01)
  const nearbyPresets = presets
    .map(p => ({ ...p, distance: Math.abs(p.frequency - frequency) }))
    .filter(p => p.distance < 50)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 5)

  // Format frequency for display
  function formatFreq(freq: number): string {
    if (freq >= 1000) {
      return `${(freq / 1000).toFixed(3)} GHz`
    }
    return `${freq.toFixed(3)} MHz`
  }

  return (
    <div className="bg-gradient-to-b from-gray-900 to-gray-800 rounded-xl p-6 shadow-2xl border border-gray-700">
      {/* Main Display */}
      <div className="bg-black rounded-lg p-4 mb-4 border border-gray-700">
        <div className="flex items-center justify-between">
          {/* Frequency Display */}
          <div className="flex-1">
            <div className="text-xs text-gray-500 mb-1">FREQUENCY</div>
            <div className="flex items-baseline">
              <input
                type="text"
                value={inputValue}
                onChange={handleInputChange}
                onBlur={handleInputBlur}
                onKeyDown={handleInputKeyDown}
                className="bg-transparent text-4xl font-mono font-bold text-green-400 w-40 outline-none focus:text-green-300"
              />
              <span className="text-xl text-green-600 ml-1">MHz</span>
            </div>
            {currentPreset && (
              <div className="text-sm text-amber-400 mt-1 flex items-center">
                <Bookmark className="h-3 w-3 mr-1" />
                {currentPreset.name}
              </div>
            )}
          </div>

          {/* Play/Stop Button */}
          {onPlayStop && (
            <button
              onClick={onPlayStop}
              className={`p-4 rounded-full transition-all ${
                isPlaying
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-green-600 hover:bg-green-700 text-white'
              }`}
            >
              {isPlaying ? (
                <Square className="h-6 w-6" />
              ) : (
                <Play className="h-6 w-6" />
              )}
            </button>
          )}
        </div>

        {/* Signal Strength Meter (visual only) */}
        <div className="mt-3 flex items-center gap-1">
          <Volume2 className="h-4 w-4 text-gray-500" />
          <div className="flex-1 flex gap-0.5">
            {[...Array(20)].map((_, i) => (
              <div
                key={i}
                className={`h-3 flex-1 rounded-sm transition-colors ${
                  i < (isPlaying ? 12 + Math.floor(Math.random() * 5) : 0)
                    ? i < 10
                      ? 'bg-green-500'
                      : i < 15
                      ? 'bg-yellow-500'
                      : 'bg-red-500'
                    : 'bg-gray-700'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Tuning Dial */}
      <div
        ref={dialRef}
        onWheel={handleWheel}
        className="relative h-16 bg-gray-800 rounded-lg overflow-hidden cursor-ew-resize border border-gray-600 mb-4"
      >
        {/* Scale markings */}
        <div className="absolute inset-0 flex items-center">
          {[...Array(51)].map((_, i) => (
            <div
              key={i}
              className="flex-1 flex flex-col items-center"
              style={{ opacity: i % 10 === 0 ? 1 : i % 5 === 0 ? 0.5 : 0.2 }}
            >
              <div
                className={`w-px bg-gray-400 ${
                  i % 10 === 0 ? 'h-4' : i % 5 === 0 ? 'h-3' : 'h-2'
                }`}
              />
            </div>
          ))}
        </div>

        {/* Current position indicator */}
        <div
          className="absolute top-0 bottom-0 w-1 bg-green-500 shadow-lg shadow-green-500/50"
          style={{ left: `${dialPosition}%`, transform: 'translateX(-50%)' }}
        >
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-green-500" />
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-green-500" />
        </div>

        {/* Preset markers */}
        {nearbyPresets.map((preset) => (
          <div
            key={preset.name}
            className="absolute top-1 bottom-1 w-0.5 bg-amber-500 opacity-50"
            style={{
              left: `${((preset.frequency - minFreq) / (maxFreq - minFreq)) * 100}%`,
            }}
            title={preset.name}
          />
        ))}

        {/* Min/Max labels */}
        <div className="absolute bottom-1 left-2 text-xs text-gray-500">{minFreq} MHz</div>
        <div className="absolute bottom-1 right-2 text-xs text-gray-500">{maxFreq} MHz</div>
      </div>

      {/* Control Buttons */}
      <div className="flex items-center justify-center gap-2 mb-4">
        {/* Previous Preset */}
        <button
          onClick={() => jumpToPreset('prev')}
          className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-300 transition-colors"
          title="Previous preset"
        >
          <SkipBack className="h-5 w-5" />
        </button>

        {/* Fine tune down */}
        <button
          onClick={() => nudgeFrequency(-step * 10)}
          className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-300 transition-colors"
          title={`-${step * 10} MHz`}
        >
          <ChevronLeft className="h-5 w-5" />
          <ChevronLeft className="h-5 w-5 -ml-3" />
        </button>

        <button
          onClick={() => nudgeFrequency(-step)}
          className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-300 transition-colors"
          title={`-${step} MHz`}
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        {/* Current frequency badge */}
        <div className="px-4 py-2 bg-gray-700 rounded-lg text-green-400 font-mono text-sm min-w-[120px] text-center">
          {formatFreq(frequency)}
        </div>

        {/* Fine tune up */}
        <button
          onClick={() => nudgeFrequency(step)}
          className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-300 transition-colors"
          title={`+${step} MHz`}
        >
          <ChevronRight className="h-5 w-5" />
        </button>

        <button
          onClick={() => nudgeFrequency(step * 10)}
          className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-300 transition-colors"
          title={`+${step * 10} MHz`}
        >
          <ChevronRight className="h-5 w-5" />
          <ChevronRight className="h-5 w-5 -ml-3" />
        </button>

        {/* Next Preset */}
        <button
          onClick={() => jumpToPreset('next')}
          className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-300 transition-colors"
          title="Next preset"
        >
          <SkipForward className="h-5 w-5" />
        </button>
      </div>

      {/* Quick Presets */}
      {presets.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs text-gray-400 uppercase tracking-wide">Quick Presets</div>
          <div className="flex flex-wrap gap-2">
            {presets.slice(0, 12).map((preset) => (
              <button
                key={preset.name}
                onClick={() => {
                  onFrequencyChange(preset.frequency)
                  onPresetSelect?.(preset)
                }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  Math.abs(preset.frequency - frequency) < 0.01
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                <div className="flex items-center">
                  <Radio className="h-3 w-3 mr-1.5" />
                  <span>{preset.name}</span>
                </div>
                <div className="text-xs opacity-70">{preset.frequency} MHz</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="mt-4 text-xs text-gray-500 text-center">
        Scroll wheel to tune • Arrow keys for fine control • Click presets to jump
      </div>
    </div>
  )
}
