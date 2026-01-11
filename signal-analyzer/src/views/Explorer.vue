<script setup lang="ts">
import { ref, onMounted } from 'vue'

interface Frequency {
  frequency: string
  region: string
  common_uses: string
}

const frequencies = ref<Frequency[]>([])
const selectedFrequency = ref<string | null>(null)
const loading = ref(true)

async function loadFrequencies() {
  try {
    const response = await fetch('/api/v1/signals/frequencies')
    const data = await response.json()
    frequencies.value = data.frequencies || []
  } catch (err) {
    console.error('Failed to load frequencies:', err)
  } finally {
    loading.value = false
  }
}

onMounted(loadFrequencies)
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h2 class="text-xl font-bold text-white">Frequency Explorer</h2>
    </div>

    <!-- Frequency Grid -->
    <div class="card">
      <h3 class="text-lg font-semibold text-white mb-4">Common Frequencies</h3>

      <div v-if="loading" class="flex items-center justify-center py-12">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          v-for="freq in frequencies"
          :key="freq.frequency"
          @click="selectedFrequency = freq.frequency"
          :class="[
            'p-4 rounded-lg border cursor-pointer transition-all',
            selectedFrequency === freq.frequency
              ? 'bg-primary-600/20 border-primary-500 scale-[1.02]'
              : 'bg-gray-900 border-gray-700 hover:border-gray-600',
          ]"
        >
          <div class="text-2xl font-bold text-primary-400 mb-2">
            {{ freq.frequency }}
          </div>
          <div class="text-sm text-gray-400 mb-2">
            📍 {{ freq.region }}
          </div>
          <div class="text-xs text-gray-500">
            {{ freq.common_uses }}
          </div>
        </div>
      </div>
    </div>

    <!-- Selected Frequency Info -->
    <div v-if="selectedFrequency" class="card">
      <h3 class="text-lg font-semibold text-white mb-4">Configuration</h3>
      <div class="bg-gray-900 rounded p-4 font-mono text-sm">
        <p class="text-gray-400">To scan this frequency with rtl_433:</p>
        <pre class="text-green-400 mt-3">rtl_433 -f {{ selectedFrequency }}</pre>
        <p class="text-gray-400 mt-4">Or add to config file:</p>
        <pre class="text-green-400 mt-2">frequency {{ selectedFrequency }}</pre>
      </div>
    </div>

    <!-- Tips -->
    <div class="card">
      <h3 class="text-lg font-semibold text-white mb-4">Exploration Tips</h3>
      <ul class="space-y-2 text-gray-400 text-sm">
        <li>📡 433.92 MHz is the most common frequency for consumer sensors in Europe/Asia</li>
        <li>🇺🇸 315 MHz is commonly used in North America for car remotes and garage doors</li>
        <li>🔍 Use rtl_433 -A (analyze mode) to detect unknown signals</li>
        <li>📊 Adjust gain with -g flag for better signal reception</li>
        <li>🎚️ Use -s flag to change sample rate for wider frequency coverage</li>
      </ul>
    </div>
  </div>
</template>
