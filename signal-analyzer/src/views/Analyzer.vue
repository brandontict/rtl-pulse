<script setup lang="ts">
import { ref, computed } from 'vue'
import { useSignalData, useWebSocket } from '../composables/useSignalData'

const { signals, isAnalyzing, error, analyzeSignals } = useSignalData()
const { connected, lastMessage } = useWebSocket()

const duration = ref(10)
const recentSignals = ref<any[]>([])

// Watch for live signals
const liveMode = ref(false)

function startAnalysis() {
  analyzeSignals(duration.value)
}

function toggleLiveMode() {
  liveMode.value = !liveMode.value
  if (liveMode.value) {
    recentSignals.value = []
  }
}

// Process incoming WebSocket messages
const processedSignals = computed(() => {
  if (liveMode.value && lastMessage.value) {
    const msg = lastMessage.value as { type: string; data: any }
    if (msg.type === 'reading') {
      recentSignals.value = [msg.data, ...recentSignals.value.slice(0, 49)]
    }
  }
  return liveMode.value ? recentSignals.value : signals.value
})
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h2 class="text-xl font-bold text-white">Signal Analyzer</h2>
      <div class="flex items-center space-x-2">
        <span :class="connected ? 'text-green-400' : 'text-red-400'" class="text-sm">
          {{ connected ? '● Connected' : '○ Disconnected' }}
        </span>
      </div>
    </div>

    <!-- Controls -->
    <div class="card">
      <div class="flex items-center space-x-4">
        <div class="flex items-center space-x-2">
          <label class="text-gray-400 text-sm">Duration:</label>
          <select
            v-model="duration"
            class="bg-gray-700 border border-gray-600 rounded px-3 py-1 text-white"
          >
            <option :value="5">5 seconds</option>
            <option :value="10">10 seconds</option>
            <option :value="30">30 seconds</option>
            <option :value="60">60 seconds</option>
          </select>
        </div>

        <button
          @click="startAnalysis"
          :disabled="isAnalyzing"
          class="btn btn-primary"
        >
          {{ isAnalyzing ? 'Analyzing...' : '🔍 Analyze Signals' }}
        </button>

        <button
          @click="toggleLiveMode"
          :class="liveMode ? 'btn-danger' : 'btn-secondary'"
          class="btn"
        >
          {{ liveMode ? '⏹ Stop Live' : '▶ Live Mode' }}
        </button>
      </div>

      <p v-if="error" class="mt-2 text-red-400 text-sm">{{ error }}</p>
    </div>

    <!-- Signal List -->
    <div class="card">
      <h3 class="text-lg font-semibold text-white mb-4">
        {{ liveMode ? 'Live Signals' : 'Detected Signals' }}
        <span class="text-gray-400 text-sm ml-2">({{ processedSignals.length }})</span>
      </h3>

      <div v-if="isAnalyzing" class="flex items-center justify-center py-12">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
        <span class="ml-3 text-gray-400">Scanning for signals...</span>
      </div>

      <div v-else-if="processedSignals.length === 0" class="text-center py-12 text-gray-500">
        <p>No signals detected.</p>
        <p class="text-sm mt-2">Click "Analyze Signals" or enable "Live Mode" to start.</p>
      </div>

      <div v-else class="space-y-2 max-h-96 overflow-y-auto">
        <div
          v-for="(signal, idx) in processedSignals"
          :key="idx"
          class="bg-gray-900 rounded p-3 font-mono text-sm"
        >
          <div class="flex items-center justify-between mb-2">
            <span class="text-primary-400 font-semibold">{{ signal.model || 'Unknown' }}</span>
            <span class="text-gray-500 text-xs">
              {{ signal.time ? new Date(signal.time).toLocaleTimeString() : 'N/A' }}
            </span>
          </div>
          <pre class="text-gray-300 text-xs overflow-x-auto">{{ JSON.stringify(signal, null, 2) }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>
