import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'

export type ThemeMode = 'light' | 'dark' | 'auto'

export const useThemeStore = defineStore('theme', () => {
  // 状态
  const mode = ref<ThemeMode>('light')
  const systemPrefersDark = ref(false)

  // 计算属性
  const isDark = computed(() => {
    if (mode.value === 'auto') {
      return systemPrefersDark.value
    }
    return mode.value === 'dark'
  })

  const currentTheme = computed(() => isDark.value ? 'dark' : 'light')

  // Actions
  const setTheme = (newMode: ThemeMode) => {
    mode.value = newMode
    applyTheme()
    saveThemePreference()
  }

  const toggleTheme = () => {
    if (mode.value === 'light') {
      setTheme('dark')
    } else if (mode.value === 'dark') {
      setTheme('light')
    } else {
      // 如果是auto模式，切换到相反的固定模式
      setTheme(systemPrefersDark.value ? 'light' : 'dark')
    }
  }

  const applyTheme = () => {
    const html = document.documentElement
    const body = document.body

    if (isDark.value) {
      html.classList.add('dark')
      body.classList.add('dark')
    } else {
      html.classList.remove('dark')
      body.classList.remove('dark')
    }

    // 更新Element Plus主题变量
    updateElementPlusTheme()
  }

  const updateElementPlusTheme = () => {
    const root = document.documentElement
    
    if (isDark.value) {
      // 暗色主题变量
      root.style.setProperty('--el-color-primary', '#409eff')
      root.style.setProperty('--el-color-primary-light-3', '#79bbff')
      root.style.setProperty('--el-color-primary-light-5', '#a0cfff')
      root.style.setProperty('--el-color-primary-light-7', '#c6e2ff')
      root.style.setProperty('--el-color-primary-light-8', '#d9ecff')
      root.style.setProperty('--el-color-primary-light-9', '#ecf5ff')
      root.style.setProperty('--el-color-primary-dark-2', '#337ecc')
      
      root.style.setProperty('--el-bg-color', '#141414')
      root.style.setProperty('--el-bg-color-page', '#0a0a0a')
      root.style.setProperty('--el-bg-color-overlay', '#1d1e1f')
      root.style.setProperty('--el-text-color-primary', '#e5eaf3')
      root.style.setProperty('--el-text-color-regular', '#cfd3dc')
      root.style.setProperty('--el-text-color-secondary', '#a3a6ad')
      root.style.setProperty('--el-text-color-placeholder', '#8d9095')
      root.style.setProperty('--el-text-color-disabled', '#6c6e72')
      root.style.setProperty('--el-border-color', '#4c4d4f')
      root.style.setProperty('--el-border-color-light', '#414243')
      root.style.setProperty('--el-border-color-lighter', '#363637')
      root.style.setProperty('--el-border-color-extra-light', '#2b2b2c')
      root.style.setProperty('--el-border-color-dark', '#58585b')
      root.style.setProperty('--el-border-color-darker', '#636466')
      root.style.setProperty('--el-fill-color', '#303133')
      root.style.setProperty('--el-fill-color-light', '#262727')
      root.style.setProperty('--el-fill-color-lighter', '#1d1d1d')
      root.style.setProperty('--el-fill-color-extra-light', '#191919')
      root.style.setProperty('--el-fill-color-dark', '#39393a')
      root.style.setProperty('--el-fill-color-darker', '#424243')
      root.style.setProperty('--el-fill-color-blank', 'transparent')
    } else {
      // 亮色主题变量（恢复默认值）
      root.style.removeProperty('--el-color-primary')
      root.style.removeProperty('--el-color-primary-light-3')
      root.style.removeProperty('--el-color-primary-light-5')
      root.style.removeProperty('--el-color-primary-light-7')
      root.style.removeProperty('--el-color-primary-light-8')
      root.style.removeProperty('--el-color-primary-light-9')
      root.style.removeProperty('--el-color-primary-dark-2')
      root.style.removeProperty('--el-bg-color')
      root.style.removeProperty('--el-bg-color-page')
      root.style.removeProperty('--el-bg-color-overlay')
      root.style.removeProperty('--el-text-color-primary')
      root.style.removeProperty('--el-text-color-regular')
      root.style.removeProperty('--el-text-color-secondary')
      root.style.removeProperty('--el-text-color-placeholder')
      root.style.removeProperty('--el-text-color-disabled')
      root.style.removeProperty('--el-border-color')
      root.style.removeProperty('--el-border-color-light')
      root.style.removeProperty('--el-border-color-lighter')
      root.style.removeProperty('--el-border-color-extra-light')
      root.style.removeProperty('--el-border-color-dark')
      root.style.removeProperty('--el-border-color-darker')
      root.style.removeProperty('--el-fill-color')
      root.style.removeProperty('--el-fill-color-light')
      root.style.removeProperty('--el-fill-color-lighter')
      root.style.removeProperty('--el-fill-color-extra-light')
      root.style.removeProperty('--el-fill-color-dark')
      root.style.removeProperty('--el-fill-color-darker')
      root.style.removeProperty('--el-fill-color-blank')
    }
  }

  const detectSystemTheme = () => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      systemPrefersDark.value = mediaQuery.matches

      // 监听系统主题变化
      mediaQuery.addEventListener('change', (e) => {
        systemPrefersDark.value = e.matches
      })
    }
  }

  const loadThemePreference = () => {
    try {
      const saved = localStorage.getItem('mcp-gateway-theme')
      if (saved && ['light', 'dark', 'auto'].includes(saved)) {
        mode.value = saved as ThemeMode
      }
    } catch (error) {
      console.warn('Failed to load theme preference:', error)
    }
  }

  const saveThemePreference = () => {
    try {
      localStorage.setItem('mcp-gateway-theme', mode.value)
    } catch (error) {
      console.warn('Failed to save theme preference:', error)
    }
  }

  const initialize = () => {
    detectSystemTheme()
    loadThemePreference()
    applyTheme()
  }

  // 监听系统主题变化，当模式为auto时自动应用
  watch(systemPrefersDark, () => {
    if (mode.value === 'auto') {
      applyTheme()
    }
  })

  // 监听主题模式变化
  watch(mode, () => {
    applyTheme()
  })

  return {
    // 状态
    mode,
    systemPrefersDark,
    
    // 计算属性
    isDark,
    currentTheme,
    
    // Actions
    setTheme,
    toggleTheme,
    applyTheme,
    initialize
  }
})