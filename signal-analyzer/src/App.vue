<script setup lang="ts">
import { RouterLink, RouterView, useRoute } from 'vue-router'

const route = useRoute()

const navItems = [
  { path: '/', label: 'Analyzer', icon: '📊' },
  { path: '/decoder', label: 'Decoder', icon: '🔓' },
  { path: '/explorer', label: 'Explorer', icon: '🔍' },
  { path: '/audio', label: 'Audio', icon: '🎧' },
]
</script>

<template>
  <div class="min-h-screen bg-gray-900">
    <!-- Header -->
    <header class="bg-gray-800 border-b border-gray-700">
      <div class="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        <div class="flex items-center space-x-3">
          <span class="text-2xl">📡</span>
          <h1 class="text-xl font-bold text-white">Signal Analyzer</h1>
        </div>
        <nav class="flex space-x-1">
          <RouterLink
            v-for="item in navItems"
            :key="item.path"
            :to="item.path"
            :class="[
              'flex items-center space-x-2 px-4 py-2 rounded-md transition-colors',
              route.path === item.path
                ? 'bg-primary-600 text-white'
                : 'text-gray-400 hover:bg-gray-700 hover:text-white',
            ]"
          >
            <span>{{ item.icon }}</span>
            <span>{{ item.label }}</span>
          </RouterLink>
        </nav>
      </div>
    </header>

    <!-- Main Content -->
    <main class="max-w-7xl mx-auto px-4 py-6">
      <RouterView />
    </main>
  </div>
</template>
