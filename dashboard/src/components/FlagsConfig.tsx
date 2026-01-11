import { useState, useEffect } from 'react'
import { Settings, Info, RotateCcw } from 'lucide-react'
import type { ProgramFlag, Frequency } from '../types'
import { api } from '../services/api'

interface FlagValue {
  [key: string]: string | number | boolean | string[]
}

interface FlagsConfigProps {
  values: FlagValue
  onChange: (values: FlagValue) => void
}

export function FlagsConfig({ values, onChange }: FlagsConfigProps) {
  const [flags, setFlags] = useState<ProgramFlag[]>([])
  const [frequencies, setFrequencies] = useState<Frequency[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedFlags, setExpandedFlags] = useState<Set<string>>(new Set())

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [flagsData, freqData] = await Promise.all([
          api.getFlags(),
          api.getFrequencies(),
        ])
        setFlags(flagsData.flags)
        setFrequencies(freqData.frequencies)

        // Initialize default values
        const defaults: FlagValue = {}
        flagsData.flags.forEach((flag) => {
          if (values[flag.name] === undefined) {
            defaults[flag.name] = flag.default as string | number | boolean | string[]
          }
        })
        if (Object.keys(defaults).length > 0) {
          onChange({ ...values, ...defaults })
        }
      } catch (error) {
        console.error('Failed to fetch flags:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const updateValue = (name: string, value: string | number | boolean | string[]) => {
    onChange({ ...values, [name]: value })
  }

  const resetToDefaults = () => {
    const defaults: FlagValue = {}
    flags.forEach((flag) => {
      defaults[flag.name] = flag.default as string | number | boolean | string[]
    })
    onChange(defaults)
  }

  const toggleFlagExpanded = (name: string) => {
    const newExpanded = new Set(expandedFlags)
    if (newExpanded.has(name)) {
      newExpanded.delete(name)
    } else {
      newExpanded.add(name)
    }
    setExpandedFlags(newExpanded)
  }

  const renderFlagInput = (flag: ProgramFlag) => {
    const value = values[flag.name] ?? flag.default

    switch (flag.type) {
      case 'text':
        return (
          <div className="space-y-2">
            <input
              type="text"
              value={value as string}
              onChange={(e) => updateValue(flag.name, e.target.value)}
              placeholder={flag.default as string}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {flag.name === 'frequency' && frequencies.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {frequencies.map((freq) => (
                  <button
                    key={freq.frequency}
                    onClick={() => updateValue(flag.name, freq.frequency)}
                    className={`px-2 py-1 text-xs rounded transition-colors ${
                      value === freq.frequency
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                    title={`${freq.region}: ${freq.common_uses}`}
                  >
                    {freq.frequency}
                  </button>
                ))}
              </div>
            )}
            {flag.examples && flag.examples.length > 0 && (
              <div className="text-xs text-slate-400">
                Examples: {flag.examples.join(', ')}
              </div>
            )}
          </div>
        )

      case 'number':
        return (
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={flag.min ?? 0}
                max={flag.max ?? 100}
                value={value as number}
                onChange={(e) => updateValue(flag.name, parseInt(e.target.value))}
                className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <input
                type="number"
                min={flag.min}
                max={flag.max}
                value={value as number}
                onChange={(e) => updateValue(flag.name, parseInt(e.target.value) || 0)}
                className="w-20 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {(flag.min !== undefined || flag.max !== undefined) && (
              <div className="text-xs text-slate-400">
                Range: {flag.min ?? 0} - {flag.max ?? 100}
              </div>
            )}
          </div>
        )

      case 'boolean':
        return (
          <label className="flex items-center gap-3 cursor-pointer">
            <div
              className={`relative w-12 h-6 rounded-full transition-colors ${
                value ? 'bg-blue-600' : 'bg-slate-600'
              }`}
            >
              <div
                className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  value ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </div>
            <input
              type="checkbox"
              checked={value as boolean}
              onChange={(e) => updateValue(flag.name, e.target.checked)}
              className="sr-only"
            />
            <span className="text-slate-300">{value ? 'Enabled' : 'Disabled'}</span>
          </label>
        )

      case 'select':
        return (
          <select
            value={value as string}
            onChange={(e) => updateValue(flag.name, e.target.value)}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {flag.options?.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        )

      case 'multiselect':
        const selectedValues = (value as string[]) || []
        return (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {flag.options?.map((option) => {
                const isSelected = selectedValues.includes(option)
                return (
                  <button
                    key={option}
                    onClick={() => {
                      if (isSelected) {
                        updateValue(
                          flag.name,
                          selectedValues.filter((v) => v !== option)
                        )
                      } else {
                        updateValue(flag.name, [...selectedValues, option])
                      }
                    }}
                    className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                      isSelected
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    {option}
                  </button>
                )
              })}
            </div>
            {selectedValues.length > 0 && (
              <div className="text-xs text-slate-400">
                Selected: {selectedValues.join(', ')}
              </div>
            )}
          </div>
        )

      default:
        return (
          <input
            type="text"
            value={value as string}
            onChange={(e) => updateValue(flag.name, e.target.value)}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        )
    }
  }

  if (loading) {
    return (
      <div className="bg-slate-800 rounded-lg p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-700 rounded w-1/3"></div>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-slate-700 rounded"></div>
          ))}
        </div>
      </div>
    )
  }

  // Group flags by category
  const coreFlags = flags.filter((f) =>
    ['frequency', 'sample_rate', 'gain', 'device'].includes(f.name)
  )
  const outputFlags = flags.filter((f) =>
    ['output_json', 'output_mqtt', 'mqtt_host', 'mqtt_port', 'mqtt_retain'].includes(f.name)
  )
  const processingFlags = flags.filter((f) =>
    ['convert', 'analyze_mode', 'verbose', 'quiet'].includes(f.name)
  )
  const otherFlags = flags.filter(
    (f) =>
      !coreFlags.includes(f) && !outputFlags.includes(f) && !processingFlags.includes(f)
  )

  const renderFlagGroup = (groupFlags: ProgramFlag[], title: string) => {
    if (groupFlags.length === 0) return null

    return (
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-slate-400 uppercase tracking-wider">
          {title}
        </h4>
        {groupFlags.map((flag) => (
          <div
            key={flag.name}
            className="bg-slate-700/50 rounded-lg p-4 space-y-3"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <code className="text-sm font-mono text-blue-400">{flag.flag}</code>
                  <span className="text-white font-medium">{flag.name}</span>
                  <span className="text-xs px-1.5 py-0.5 bg-slate-600 text-slate-300 rounded">
                    {flag.type}
                  </span>
                </div>
                <p className="text-sm text-slate-400 mt-1">{flag.desc}</p>
              </div>
              <button
                onClick={() => toggleFlagExpanded(flag.name)}
                className="text-slate-400 hover:text-white transition-colors p-1"
                title="More info"
              >
                <Info className="w-4 h-4" />
              </button>
            </div>

            {expandedFlags.has(flag.name) && (
              <div className="text-xs text-slate-400 bg-slate-800 rounded p-2">
                <div>Default: <code className="text-blue-300">{JSON.stringify(flag.default)}</code></div>
                {flag.min !== undefined && <div>Min: {flag.min}</div>}
                {flag.max !== undefined && <div>Max: {flag.max}</div>}
                {flag.options && <div>Options: {flag.options.join(', ')}</div>}
              </div>
            )}

            {renderFlagInput(flag)}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="bg-slate-800 rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Settings className="w-5 h-5 text-blue-400" />
          Program Flags Configuration
        </h3>
        <button
          onClick={resetToDefaults}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          Reset to Defaults
        </button>
      </div>

      <div className="space-y-6">
        {renderFlagGroup(coreFlags, 'Core Settings')}
        {renderFlagGroup(outputFlags, 'Output Configuration')}
        {renderFlagGroup(processingFlags, 'Processing Options')}
        {renderFlagGroup(otherFlags, 'Additional Flags')}
      </div>
    </div>
  )
}
