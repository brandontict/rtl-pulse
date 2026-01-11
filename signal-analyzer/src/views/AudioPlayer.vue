<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'

interface Preset {
  name: string
  frequency?: string
  frequencies?: string[]
  start?: string
  end?: string
  mode: string
  step?: string
}

interface Modulation {
  id: string
  name: string
  description: string
}

interface AudioStatus {
  running: boolean
  frequency: string | null
  modulation: string | null
  sample_rate: number | null
  output_rate: number | null
  gain: number | null
}

const API_BASE = 'http://localhost:8000/api/v1'

// State
const frequency = ref('101.5M')
const modulation = ref('wbfm')
const gain = ref(40)
const squelch = ref(0)
const volume = ref(0.7)
const isPlaying = ref(false)
const isLoading = ref(false)
const error = ref<string | null>(null)
const presets = ref<Preset[]>([])
const modulations = ref<Modulation[]>([])
const audioStatus = ref<AudioStatus | null>(null)

// Audio context and nodes
let audioContext: AudioContext | null = null
let sourceNode: AudioBufferSourceNode | null = null
let gainNode: GainNode | null = null
let analyserNode: AnalyserNode | null = null
let abortController: AbortController | null = null

// Visualization
const canvasRef = ref<HTMLCanvasElement | null>(null)
const visualizationMode = ref<'waveform' | 'spectrum'>('spectrum')
let animationFrame: number | null = null

// Computed
const frequencyNum = computed(() => {
  const match = frequency.value.match(/^([\d.]+)([MKk]?)$/)
  if (!match) return 0
  const num = parseFloat(match[1])
  const unit = match[2].toUpperCase()
  if (unit === 'M') return num * 1000000
  if (unit === 'K') return num * 1000
  return num
})

const frequencyDisplay = computed(() => {
  const hz = frequencyNum.value
  if (hz >= 1000000) return `${(hz / 1000000).toFixed(3)} MHz`
  if (hz >= 1000) return `${(hz / 1000).toFixed(1)} kHz`
  return `${hz} Hz`
})

// Methods
async function fetchPresets() {
  try {
    const res = await fetch(`${API_BASE}/audio/presets`)
    const data = await res.json()
    presets.value = data.presets
  } catch (e) {
    console.error('Failed to fetch presets:', e)
  }
}

async function fetchModulations() {
  try {
    const res = await fetch(`${API_BASE}/audio/modulations`)
    const data = await res.json()
    modulations.value = data.modulations
  } catch (e) {
    console.error('Failed to fetch modulations:', e)
  }
}

async function fetchStatus() {
  try {
    const res = await fetch(`${API_BASE}/audio/status`)
    audioStatus.value = await res.json()
    isPlaying.value = audioStatus.value?.running ?? false
  } catch (e) {
    console.error('Failed to fetch status:', e)
  }
}

async function startAudio() {
  error.value = null
  isLoading.value = true

  try {
    // Start backend audio streaming
    const res = await fetch(`${API_BASE}/audio/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        frequency: frequency.value,
        modulation: modulation.value,
        gain: gain.value,
        squelch: squelch.value,
      }),
    })

    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.detail || 'Failed to start audio')
    }

    // Initialize Web Audio API
    audioContext = new AudioContext({ sampleRate: 48000 })
    gainNode = audioContext.createGain()
    gainNode.gain.value = volume.value
    gainNode.connect(audioContext.destination)

    analyserNode = audioContext.createAnalyser()
    analyserNode.fftSize = 2048
    gainNode.connect(analyserNode)

    // Start streaming audio
    abortController = new AbortController()
    streamAudio()

    isPlaying.value = true
    startVisualization()

  } catch (e: any) {
    error.value = e.message
  } finally {
    isLoading.value = false
  }
}

async function streamAudio() {
  if (!audioContext || !gainNode) return

  try {
    const response = await fetch(`${API_BASE}/audio/stream`, {
      signal: abortController?.signal,
    })

    if (!response.ok || !response.body) {
      throw new Error('Failed to get audio stream')
    }

    const reader = response.body.getReader()
    const chunks: Uint8Array[] = []
    let totalLength = 0
    const BUFFER_SIZE = 48000 * 2 // 1 second of audio (16-bit mono)

    while (true) {
      const { done, value } = await reader.read()

      if (done) break

      chunks.push(value)
      totalLength += value.length

      // Process when we have enough data
      if (totalLength >= BUFFER_SIZE) {
        const combined = new Uint8Array(totalLength)
        let offset = 0
        for (const chunk of chunks) {
          combined.set(chunk, offset)
          offset += chunk.length
        }

        // Convert to Float32 for Web Audio API
        const audioBuffer = audioContext.createBuffer(1, combined.length / 2, 48000)
        const channelData = audioBuffer.getChannelData(0)

        for (let i = 0; i < combined.length; i += 2) {
          // Convert 16-bit signed little-endian to float
          const sample = (combined[i] | (combined[i + 1] << 8))
          const signedSample = sample > 32767 ? sample - 65536 : sample
          channelData[i / 2] = signedSample / 32768
        }

        // Play the buffer
        const source = audioContext.createBufferSource()
        source.buffer = audioBuffer
        source.connect(gainNode)
        source.start()

        // Reset chunks
        chunks.length = 0
        totalLength = 0
      }
    }
  } catch (e: any) {
    if (e.name !== 'AbortError') {
      console.error('Stream error:', e)
      error.value = e.message
    }
  }
}

async function stopAudio() {
  isLoading.value = true

  try {
    // Abort stream
    abortController?.abort()
    abortController = null

    // Stop backend
    await fetch(`${API_BASE}/audio/stop`, { method: 'POST' })

    // Cleanup audio context
    if (audioContext) {
      await audioContext.close()
      audioContext = null
    }

    isPlaying.value = false
    stopVisualization()

  } catch (e: any) {
    error.value = e.message
  } finally {
    isLoading.value = false
  }
}

async function tuneFrequency(newFreq: string) {
  frequency.value = newFreq
  if (isPlaying.value) {
    try {
      await fetch(`${API_BASE}/audio/tune?frequency=${encodeURIComponent(newFreq)}`, {
        method: 'POST',
      })
    } catch (e: any) {
      error.value = e.message
    }
  }
}

function selectPreset(preset: Preset) {
  if (preset.frequency) {
    frequency.value = preset.frequency
  } else if (preset.frequencies && preset.frequencies.length > 0) {
    frequency.value = preset.frequencies[0]
  } else if (preset.start) {
    frequency.value = preset.start
  }
  modulation.value = preset.mode
}

function adjustVolume() {
  if (gainNode) {
    gainNode.gain.value = volume.value
  }
}

function startVisualization() {
  if (!canvasRef.value || !analyserNode) return

  const canvas = canvasRef.value
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const bufferLength = analyserNode.frequencyBinCount
  const dataArray = new Uint8Array(bufferLength)

  function draw() {
    if (!ctx || !analyserNode || !isPlaying.value) return

    animationFrame = requestAnimationFrame(draw)

    if (visualizationMode.value === 'spectrum') {
      analyserNode.getByteFrequencyData(dataArray)
    } else {
      analyserNode.getByteTimeDomainData(dataArray)
    }

    ctx.fillStyle = 'rgb(15, 23, 42)'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    if (visualizationMode.value === 'spectrum') {
      // Spectrum visualization
      const barWidth = (canvas.width / bufferLength) * 2.5
      let x = 0

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height

        const hue = (i / bufferLength) * 120 + 200
        ctx.fillStyle = `hsl(${hue}, 70%, 50%)`
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight)

        x += barWidth + 1
      }
    } else {
      // Waveform visualization
      ctx.lineWidth = 2
      ctx.strokeStyle = 'rgb(59, 130, 246)'
      ctx.beginPath()

      const sliceWidth = canvas.width / bufferLength
      let x = 0

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0
        const y = (v * canvas.height) / 2

        if (i === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }

        x += sliceWidth
      }

      ctx.lineTo(canvas.width, canvas.height / 2)
      ctx.stroke()
    }
  }

  draw()
}

function stopVisualization() {
  if (animationFrame) {
    cancelAnimationFrame(animationFrame)
    animationFrame = null
  }
}

// Lifecycle
onMounted(() => {
  fetchPresets()
  fetchModulations()
  fetchStatus()
})

onUnmounted(() => {
  if (isPlaying.value) {
    stopAudio()
  }
})
</script>

<template>
  <div class="min-h-screen bg-slate-900 p-6">
    <div class="max-w-6xl mx-auto">
      <!-- Header -->
      <div class="flex items-center justify-between mb-8">
        <div>
          <h1 class="text-3xl font-bold text-white flex items-center gap-3">
            <svg class="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15.536a5 5 0 001.414 1.414m2.828-9.9a9 9 0 0112.728 0" />
            </svg>
            Audio Receiver
          </h1>
          <p class="text-slate-400 mt-1">Listen to radio frequencies with rtl_fm</p>
        </div>

        <div class="text-right">
          <div class="text-2xl font-mono text-green-400">{{ frequencyDisplay }}</div>
          <div class="text-sm text-slate-400">{{ modulation.toUpperCase() }}</div>
        </div>
      </div>

      <!-- Error Alert -->
      <div v-if="error" class="mb-6 p-4 bg-red-900/50 border border-red-500 rounded-lg text-red-200">
        <div class="flex items-center gap-2">
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
          </svg>
          {{ error }}
        </div>
      </div>

      <div class="grid gap-6 lg:grid-cols-3">
        <!-- Main Controls -->
        <div class="lg:col-span-2 space-y-6">
          <!-- Visualization -->
          <div class="bg-slate-800 rounded-lg p-4">
            <div class="flex items-center justify-between mb-3">
              <h3 class="text-sm font-medium text-slate-400">Signal Visualization</h3>
              <div class="flex gap-2">
                <button
                  @click="visualizationMode = 'spectrum'"
                  :class="[
                    'px-3 py-1 text-xs rounded transition-colors',
                    visualizationMode === 'spectrum'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  ]"
                >
                  Spectrum
                </button>
                <button
                  @click="visualizationMode = 'waveform'"
                  :class="[
                    'px-3 py-1 text-xs rounded transition-colors',
                    visualizationMode === 'waveform'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  ]"
                >
                  Waveform
                </button>
              </div>
            </div>
            <canvas
              ref="canvasRef"
              class="w-full h-32 bg-slate-900 rounded"
              width="800"
              height="128"
            ></canvas>
          </div>

          <!-- Frequency Input -->
          <div class="bg-slate-800 rounded-lg p-6">
            <h3 class="text-lg font-semibold text-white mb-4">Tuning</h3>

            <div class="grid gap-4 sm:grid-cols-2">
              <div>
                <label class="block text-sm text-slate-400 mb-2">Frequency</label>
                <input
                  v-model="frequency"
                  type="text"
                  placeholder="101.5M"
                  class="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white text-lg font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p class="text-xs text-slate-500 mt-1">Examples: 101.5M, 433.92M, 162.55M</p>
              </div>

              <div>
                <label class="block text-sm text-slate-400 mb-2">Modulation</label>
                <select
                  v-model="modulation"
                  class="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option v-for="mod in modulations" :key="mod.id" :value="mod.id">
                    {{ mod.name }}
                  </option>
                </select>
              </div>
            </div>

            <!-- Gain & Squelch -->
            <div class="grid gap-4 sm:grid-cols-2 mt-4">
              <div>
                <label class="block text-sm text-slate-400 mb-2">Gain: {{ gain }} dB</label>
                <input
                  v-model.number="gain"
                  type="range"
                  min="0"
                  max="50"
                  class="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>

              <div>
                <label class="block text-sm text-slate-400 mb-2">Squelch: {{ squelch }}</label>
                <input
                  v-model.number="squelch"
                  type="range"
                  min="0"
                  max="100"
                  class="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>
            </div>

            <!-- Volume -->
            <div class="mt-4">
              <label class="block text-sm text-slate-400 mb-2">
                Volume: {{ Math.round(volume * 100) }}%
              </label>
              <input
                v-model.number="volume"
                @input="adjustVolume"
                type="range"
                min="0"
                max="1"
                step="0.01"
                class="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-green-500"
              />
            </div>

            <!-- Play/Stop Buttons -->
            <div class="flex gap-4 mt-6">
              <button
                v-if="!isPlaying"
                @click="startAudio"
                :disabled="isLoading"
                class="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-green-800 text-white rounded-lg transition-colors font-medium"
              >
                <svg v-if="!isLoading" class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd" />
                </svg>
                <svg v-else class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {{ isLoading ? 'Starting...' : 'Start Listening' }}
              </button>

              <button
                v-else
                @click="stopAudio"
                :disabled="isLoading"
                class="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 disabled:bg-red-800 text-white rounded-lg transition-colors font-medium"
              >
                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clip-rule="evenodd" />
                </svg>
                {{ isLoading ? 'Stopping...' : 'Stop' }}
              </button>
            </div>
          </div>
        </div>

        <!-- Presets Sidebar -->
        <div class="space-y-6">
          <div class="bg-slate-800 rounded-lg p-4">
            <h3 class="text-lg font-semibold text-white mb-4">Frequency Presets</h3>

            <div class="space-y-2 max-h-96 overflow-y-auto">
              <button
                v-for="preset in presets"
                :key="preset.name"
                @click="selectPreset(preset)"
                class="w-full text-left p-3 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
              >
                <div class="text-white font-medium">{{ preset.name }}</div>
                <div class="text-sm text-slate-400">
                  <span v-if="preset.frequency">{{ preset.frequency }}</span>
                  <span v-else-if="preset.start && preset.end">{{ preset.start }} - {{ preset.end }}</span>
                  <span v-else-if="preset.frequencies">{{ preset.frequencies.length }} channels</span>
                  <span class="ml-2 text-xs px-1.5 py-0.5 bg-slate-600 rounded">{{ preset.mode.toUpperCase() }}</span>
                </div>
              </button>
            </div>
          </div>

          <!-- Quick Frequencies -->
          <div class="bg-slate-800 rounded-lg p-4">
            <h3 class="text-lg font-semibold text-white mb-4">Quick Tune</h3>

            <div class="grid grid-cols-2 gap-2">
              <button
                v-for="freq in ['88.1M', '101.5M', '107.9M', '162.55M', '433.92M', '315M', '868M', '915M']"
                :key="freq"
                @click="tuneFrequency(freq)"
                :class="[
                  'px-3 py-2 rounded-lg text-sm font-mono transition-colors',
                  frequency === freq
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                ]"
              >
                {{ freq }}
              </button>
            </div>
          </div>

          <!-- Status -->
          <div class="bg-slate-800 rounded-lg p-4">
            <h3 class="text-lg font-semibold text-white mb-4">Status</h3>

            <div class="space-y-2 text-sm">
              <div class="flex justify-between">
                <span class="text-slate-400">State</span>
                <span :class="isPlaying ? 'text-green-400' : 'text-slate-500'">
                  {{ isPlaying ? 'Playing' : 'Stopped' }}
                </span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-400">Frequency</span>
                <span class="text-white font-mono">{{ frequency }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-400">Modulation</span>
                <span class="text-white">{{ modulation.toUpperCase() }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-400">Gain</span>
                <span class="text-white">{{ gain }} dB</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
