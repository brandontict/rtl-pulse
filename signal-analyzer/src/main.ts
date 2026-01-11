import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import './style.css'

import Analyzer from './views/Analyzer.vue'
import Decoder from './views/Decoder.vue'
import Explorer from './views/Explorer.vue'
import AudioPlayer from './views/AudioPlayer.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: Analyzer },
    { path: '/decoder', component: Decoder },
    { path: '/explorer', component: Explorer },
    { path: '/audio', component: AudioPlayer },
  ],
})

createApp(App).use(router).mount('#app')
