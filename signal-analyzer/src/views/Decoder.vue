<script setup lang="ts">
import { ref } from 'vue'
import { useProtocols } from '../composables/useSignalData'

const { protocols, loading } = useProtocols()
const selectedProtocol = ref<number | null>(null)
const filterType = ref('')

const filteredProtocols = computed(() => {
  if (!filterType.value) return protocols.value
  return protocols.value.filter((p) =>
    p.type.toLowerCase().includes(filterType.value.toLowerCase())
  )
})

import { computed } from 'vue'
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h2 class="text-xl font-bold text-white">Protocol Decoder</h2>
    </div>

    <!-- Filter -->
    <div class="card">
      <div class="flex items-center space-x-4">
        <input
          v-model="filterType"
          type="text"
          placeholder="Filter by type (e.g., Temperature, Weather)..."
          class="flex-1 bg-gray-700 border border-gray-600 rounded px-4 py-2 text-white placeholder-gray-400"
        />
      </div>
    </div>

    <!-- Protocol List -->
    <div class="card">
      <h3 class="text-lg font-semibold text-white mb-4">
        Supported Protocols
        <span class="text-gray-400 text-sm ml-2">({{ filteredProtocols.length }})</span>
      </h3>

      <div v-if="loading" class="flex items-center justify-center py-12">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        <div
          v-for="protocol in filteredProtocols"
          :key="protocol.id"
          @click="selectedProtocol = protocol.id"
          :class="[
            'p-4 rounded-lg border cursor-pointer transition-colors',
            selectedProtocol === protocol.id
              ? 'bg-primary-600/20 border-primary-500'
              : 'bg-gray-900 border-gray-700 hover:border-gray-600',
          ]"
        >
          <div class="flex items-center justify-between mb-2">
            <span class="text-primary-400 font-mono text-sm">Protocol {{ protocol.id }}</span>
            <span class="text-xs px-2 py-0.5 rounded bg-gray-700 text-gray-300">
              {{ protocol.type }}
            </span>
          </div>
          <p class="text-white text-sm">{{ protocol.name }}</p>
        </div>
      </div>
    </div>

    <!-- Selected Protocol Details -->
    <div v-if="selectedProtocol" class="card">
      <h3 class="text-lg font-semibold text-white mb-4">Protocol Details</h3>
      <div class="bg-gray-900 rounded p-4 font-mono text-sm">
        <p class="text-gray-400">
          Protocol ID: <span class="text-primary-400">{{ selectedProtocol }}</span>
        </p>
        <p class="text-gray-400 mt-2">
          To enable this protocol in rtl_433 config:
        </p>
        <pre class="text-green-400 mt-2">protocol {{ selectedProtocol }}</pre>
      </div>
    </div>
  </div>
</template>
