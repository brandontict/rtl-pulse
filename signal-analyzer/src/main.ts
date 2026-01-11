import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import './style.css'

import Analyzer from './views/Analyzer.vue'
import Decoder from './views/Decoder.vue'
import Explorer from './views/Explorer.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: Analyzer },
    { path: '/decoder', component: Decoder },
    { path: '/explorer', component: Explorer },
  ],
})

createApp(App).use(router).mount('#app')
