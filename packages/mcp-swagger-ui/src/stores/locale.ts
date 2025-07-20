import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { setLocale, loadLocalePreference, type Locale, SUPPORT_LOCALES } from '@/locales'

export const useLocaleStore = defineStore('locale', () => {
  // 状态
  const currentLocale = ref<Locale>('zh-CN')

  // 计算属性
  const currentLanguage = computed(() => {
    const locale = SUPPORT_LOCALES.find(l => l.value === currentLocale.value)
    return locale || SUPPORT_LOCALES[0]
  })

  const isZhCN = computed(() => currentLocale.value === 'zh-CN')
  const isEnUS = computed(() => currentLocale.value === 'en-US')

  // Actions
  const changeLocale = (locale: Locale) => {
    currentLocale.value = locale
    setLocale(locale)
  }

  const toggleLocale = () => {
    const newLocale = currentLocale.value === 'zh-CN' ? 'en-US' : 'zh-CN'
    changeLocale(newLocale)
  }

  const initialize = () => {
    const savedLocale = loadLocalePreference()
    currentLocale.value = savedLocale
    setLocale(savedLocale)
  }

  return {
    // 状态
    currentLocale,
    
    // 计算属性
    currentLanguage,
    isZhCN,
    isEnUS,
    
    // Actions
    changeLocale,
    toggleLocale,
    initialize
  }
})
