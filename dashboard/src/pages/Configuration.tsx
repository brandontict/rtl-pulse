import { useState } from 'react'
import { Cpu, Download, Copy, Check, FileCode } from 'lucide-react'
import { ProtocolSelector } from '../components/ProtocolSelector'
import { FlagsConfig } from '../components/FlagsConfig'
import { api } from '../services/api'

interface FlagValues {
  [key: string]: string | number | boolean | string[]
}

export default function ConfigurationPage() {
  const [selectedProtocols, setSelectedProtocols] = useState<number[]>([])
  const [flagValues, setFlagValues] = useState<FlagValues>({})
  const [generatedConfig, setGeneratedConfig] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState(false)

  const generateConfig = async () => {
    setGenerating(true)
    try {
      const result = await api.generateConfig({
        protocols: selectedProtocols,
        frequency: (flagValues.frequency as string) || '433.92M',
        sample_rate: (flagValues.sample_rate as string) || '1024k',
        gain: (flagValues.gain as number) || 40,
        output_json: (flagValues.output_json as boolean) ?? true,
        output_mqtt: (flagValues.output_mqtt as boolean) ?? false,
        mqtt_host: (flagValues.mqtt_host as string) || 'localhost',
      })
      setGeneratedConfig(result.config)
    } catch (error) {
      console.error('Failed to generate config:', error)
    } finally {
      setGenerating(false)
    }
  }

  const copyConfig = async () => {
    if (generatedConfig) {
      await navigator.clipboard.writeText(generatedConfig)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const downloadConfig = () => {
    if (generatedConfig) {
      const blob = new Blob([generatedConfig], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'rtl_433.conf'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }
  }

  return (
    <div className="min-h-screen bg-slate-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Cpu className="w-8 h-8 text-blue-400" />
            <div>
              <h1 className="text-2xl font-bold text-white">RTL-433 Configuration</h1>
              <p className="text-slate-400">
                Configure protocols and program flags for rtl_433
              </p>
            </div>
          </div>

          <button
            onClick={generateConfig}
            disabled={generating}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white rounded-lg transition-colors"
          >
            <FileCode className="w-5 h-5" />
            {generating ? 'Generating...' : 'Generate Config'}
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left Column: Protocol Selector */}
          <div>
            <ProtocolSelector
              selectedProtocols={selectedProtocols}
              onSelectionChange={setSelectedProtocols}
            />
          </div>

          {/* Right Column: Flags Configuration */}
          <div>
            <FlagsConfig values={flagValues} onChange={setFlagValues} />
          </div>
        </div>

        {/* Generated Config Preview */}
        {generatedConfig && (
          <div className="mt-6 bg-slate-800 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <FileCode className="w-5 h-5 text-green-400" />
                Generated Configuration
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={copyConfig}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-green-400" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy
                    </>
                  )}
                </button>
                <button
                  onClick={downloadConfig}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
              </div>
            </div>

            <pre className="bg-slate-900 rounded-lg p-4 overflow-x-auto">
              <code className="text-sm text-green-300 font-mono whitespace-pre">
                {generatedConfig}
              </code>
            </pre>

            <div className="mt-4 text-sm text-slate-400">
              <p>
                Save this file to <code className="text-blue-400">config/rtl_433.conf</code> and
                restart rtl_433 to apply changes.
              </p>
            </div>
          </div>
        )}

        {/* Quick Stats */}
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-800 rounded-lg p-4">
            <div className="text-3xl font-bold text-blue-400">{selectedProtocols.length}</div>
            <div className="text-sm text-slate-400">Protocols Selected</div>
          </div>
          <div className="bg-slate-800 rounded-lg p-4">
            <div className="text-3xl font-bold text-green-400">
              {flagValues.frequency || '433.92M'}
            </div>
            <div className="text-sm text-slate-400">Frequency</div>
          </div>
          <div className="bg-slate-800 rounded-lg p-4">
            <div className="text-3xl font-bold text-purple-400">
              {flagValues.gain || 40} dB
            </div>
            <div className="text-sm text-slate-400">Gain</div>
          </div>
          <div className="bg-slate-800 rounded-lg p-4">
            <div className="text-3xl font-bold text-orange-400">
              {flagValues.sample_rate || '1024k'}
            </div>
            <div className="text-sm text-slate-400">Sample Rate</div>
          </div>
        </div>
      </div>
    </div>
  )
}
