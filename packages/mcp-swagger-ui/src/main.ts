import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import App from './App.vue'
import router from './router'
import './assets/styles/main.css'

const app = createApp(App)

// 注册所有图标
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

// 创建 Pinia 实例
const pinia = createPinia()

app.use(pinia)
app.use(router)
app.use(ElementPlus)

// 初始化应用
async function initializeApp() {
  // 动态导入 stores 以避免循环依赖
  const { useAppStore, useThemeStore, useWebSocketStore } = await import('./stores')
  
  // 初始化核心 stores
  const appStore = useAppStore()
  const themeStore = useThemeStore()
  const websocketStore = useWebSocketStore()
  
  // 初始化应用状态
  appStore.initialize()
  themeStore.initialize()
  
  // 初始化 WebSocket 连接（异步）
  websocketStore.initialize().catch(error => {
    console.warn('WebSocket initialization failed:', error)
  })
}

app.mount('#app')

// 应用挂载后初始化
initializeApp().catch(error => {
  console.error('App initialization failed:', error)
})
