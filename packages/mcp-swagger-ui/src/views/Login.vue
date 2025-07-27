<template>
  <div class="login-container">
    <!-- AI网关背景装饰 -->
    <div class="background-decoration">
      <div class="circuit-pattern"></div>
      <div class="floating-nodes">
        <div class="node" v-for="i in 12" :key="i" :style="getNodeStyle(i)"></div>
      </div>
    </div>

    <div class="login-card">
      <!-- 顶部工具栏 -->
      <div class="login-toolbar">
        <!-- 语言切换 -->
        <el-dropdown @command="handleLanguageChange" trigger="click" size="small">
          <el-button text class="toolbar-btn">
            {{ localeStore.currentLanguage.flag }}
            <el-icon class="el-icon--right"><CaretBottom /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item 
                v-for="locale in supportedLocales" 
                :key="locale.value"
                :command="locale.value"
                :disabled="localeStore.currentLanguage && locale.value === localeStore.currentLanguage.value"
              >
                {{ locale.flag }} {{ locale.label }}
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
      
      <!-- Logo和标题区域 -->
      <div class="login-header">
        <div class="logo-container">
          <div class="logo">
            <svg viewBox="0 0 100 100" class="logo-icon">
              <!-- AI网关Logo设计 -->
              <defs>
                <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
                  <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
                </linearGradient>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                  <feMerge> 
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/> 
                  </feMerge>
                </filter>
              </defs>
              
              <!-- 外圈 -->
              <circle cx="50" cy="50" r="45" fill="none" stroke="url(#logoGradient)" stroke-width="2" opacity="0.3"/>
              
              <!-- 内部网络节点 -->
              <circle cx="30" cy="30" r="4" fill="url(#logoGradient)" filter="url(#glow)"/>
              <circle cx="70" cy="30" r="4" fill="url(#logoGradient)" filter="url(#glow)"/>
              <circle cx="50" cy="50" r="6" fill="url(#logoGradient)" filter="url(#glow)"/>
              <circle cx="30" cy="70" r="4" fill="url(#logoGradient)" filter="url(#glow)"/>
              <circle cx="70" cy="70" r="4" fill="url(#logoGradient)" filter="url(#glow)"/>
              
              <!-- 连接线 -->
              <line x1="30" y1="30" x2="50" y2="50" stroke="url(#logoGradient)" stroke-width="2" opacity="0.6"/>
              <line x1="70" y1="30" x2="50" y2="50" stroke="url(#logoGradient)" stroke-width="2" opacity="0.6"/>
              <line x1="30" y1="70" x2="50" y2="50" stroke="url(#logoGradient)" stroke-width="2" opacity="0.6"/>
              <line x1="70" y1="70" x2="50" y2="50" stroke="url(#logoGradient)" stroke-width="2" opacity="0.6"/>
              
              <!-- AI符号 -->
              <text x="50" y="55" text-anchor="middle" fill="url(#logoGradient)" font-size="12" font-weight="bold" font-family="Arial, sans-serif">AI</text>
            </svg>
          </div>
          <div class="brand-text">
            <h1 class="brand-title">MCP Gateway</h1>
            <p class="brand-subtitle">AI-Powered API Gateway</p>
          </div>
        </div>
        <div class="login-title-section">
          <h2 class="login-title">{{ $t('userAuth.login.title') }}</h2>
          <p class="login-subtitle">{{ $t('userAuth.login.subtitle') }}</p>
        </div>
      </div>

      <div class="login-form">
        <form @submit.prevent="handleSubmit">
          <div class="form-group">
            <label for="username" class="form-label">
              <svg class="label-icon" viewBox="0 0 24 24">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
              </svg>
              {{ $t('userAuth.login.usernameOrEmail') }}
            </label>
            <input
              id="username"
              v-model="form.username"
              type="text"
              class="form-input"
              :class="{ 'error': errors.username }"
              :placeholder="$t('userAuth.login.enterUsername')"
              required
              :disabled="authLoading"
            />
            <span v-if="errors.username" class="error-message">{{ errors.username }}</span>
          </div>

          <div class="form-group">
            <label for="password" class="form-label">
              <svg class="label-icon" viewBox="0 0 24 24">
                <path d="M18,8h-1V6c0-2.76-2.24-5-5-5S7,3.24,7,6v2H6c-1.1,0-2,0.9-2,2v10c0,1.1,0.9,2,2,2h12c1.1,0,2-0.9,2-2V10C20,8.9,19.1,8,18,8z M12,17c-1.1,0-2-0.9-2-2s0.9-2,2-2s2,0.9,2,2S13.1,17,12,17z M15.1,8H8.9V6c0-1.71,1.39-3.1,3.1-3.1s3.1,1.39,3.1,3.1V8z"/>
              </svg>
              {{ $t('userAuth.login.password') }}
            </label>
            <div class="password-input-wrapper">
              <input
                id="password"
                v-model="form.password"
                :type="showPassword ? 'text' : 'password'"
                class="form-input"
                :class="{ 'error': errors.password }"
                :placeholder="$t('userAuth.login.enterPassword')"
                required
                :disabled="authLoading"
              />
              <button
                type="button"
                class="password-toggle"
                @click="showPassword = !showPassword"
                :disabled="authLoading"
              >
                <svg v-if="showPassword" class="icon" viewBox="0 0 24 24">
                  <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                </svg>
                <svg v-else class="icon" viewBox="0 0 24 24">
                  <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/>
                </svg>
              </button>
            </div>
            <span v-if="errors.password" class="error-message">{{ errors.password }}</span>
          </div>

          <div class="form-options">
            <label class="checkbox-wrapper">
              <input
                v-model="form.rememberMe"
                type="checkbox"
                class="checkbox"
                :disabled="authLoading"
              />
              <span class="checkbox-label">{{ $t('userAuth.login.rememberMe') }}</span>
            </label>
          </div>

          <button
            type="submit"
            class="login-button"
            :disabled="authLoading || !isFormValid"
          >
            <svg v-if="authLoading" class="loading-icon" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" opacity="0.25"/>
              <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" fill="currentColor"/>
            </svg>
            <span v-if="!authLoading">{{ $t('userAuth.login.loginButton') }}</span>
            <span v-else>{{ $t('userAuth.login.loggingIn') }}</span>
          </button>
        </form>


      </div>

      <!-- 错误提示 -->
      <div v-if="authError" class="error-alert">
        <svg class="error-icon" viewBox="0 0 24 24">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
        </svg>
        <span>{{ authError }}</span>
        <button @click="clearAuthError" class="error-close">
          <svg viewBox="0 0 24 24">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { CaretBottom } from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'
import { useLocaleStore } from '@/stores/locale'
import { SUPPORT_LOCALES, type Locale } from '@/locales'
import type { LoginCredentials } from '@/types'

const router = useRouter()
const authStore = useAuthStore()
const localeStore = useLocaleStore()
const { t } = useI18n()

// 响应式数据
const form = ref<LoginCredentials & { rememberMe: boolean }>({
  username: '',
  password: '',
  rememberMe: false
})

const showPassword = ref(false)
const errors = ref<Record<string, string>>({})

// 计算属性
const { authLoading, authError, isAuthenticated } = authStore
const { clearAuthError } = authStore

const supportedLocales = SUPPORT_LOCALES

const isFormValid = computed(() => {
  return form.value.username.trim() !== '' && 
         form.value.password.trim() !== '' && 
         form.value.password.length >= 6
})

// 生成浮动节点样式
const getNodeStyle = (index: number) => {
  const angle = (index * 30) % 360
  const radius = 20 + (index % 3) * 15
  const x = Math.cos(angle * Math.PI / 180) * radius
  const y = Math.sin(angle * Math.PI / 180) * radius
  const delay = index * 0.5
  
  return {
    left: `calc(50% + ${x}px)`,
    top: `calc(50% + ${y}px)`,
    animationDelay: `${delay}s`
  }
}

// 表单验证
const validateForm = (): boolean => {
  errors.value = {}
  
  if (!form.value.username.trim()) {
    errors.value.username = t('userAuth.validation.usernameRequired')
  }
  
  if (!form.value.password.trim()) {
    errors.value.password = t('userAuth.validation.passwordRequired')
  } else if (form.value.password.length < 6) {
    errors.value.password = t('userAuth.validation.passwordMinLength')
  }
  
  return Object.keys(errors.value).length === 0
}

// 处理表单提交
const handleSubmit = async () => {
  if (!validateForm()) {
    return
  }
  
  const success = await authStore.login({
    username: form.value.username,
    password: form.value.password
  })
  
  if (success) {
    // 登录成功，跳转到首页或之前访问的页面
    const redirect = router.currentRoute.value.query.redirect as string
    router.push(redirect || '/dashboard')
  }
}

// 语言切换
const handleLanguageChange = (locale: string) => {
  try {
    const targetLocale = locale as Locale
    localeStore.changeLocale(targetLocale)
    const language = SUPPORT_LOCALES.find(l => l.value === targetLocale)
    ElMessage.success(t('language.switched', { language: language?.label || targetLocale }))
  } catch (error: any) {
    ElMessage.error(t('error.operationFailed'))
  }
}

// 生命周期
onMounted(() => {
  // 如果已经登录，直接跳转
  if (isAuthenticated) {
    router.push('/dashboard')
  }
  
  // 清除之前的错误
  clearAuthError()
})
</script>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(180deg, var(--bg-secondary) 0%, var(--bg-tertiary) 100%);
  padding: 1rem;
  position: relative;
  overflow: hidden;
}

.background-decoration {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 1;
}

.circuit-pattern {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-image: 
    radial-gradient(circle at 25% 25%, rgba(0, 122, 255, 0.1) 1px, transparent 1px),
    radial-gradient(circle at 75% 75%, rgba(0, 122, 255, 0.1) 1px, transparent 1px),
    linear-gradient(45deg, transparent 40%, rgba(0, 122, 255, 0.05) 50%, transparent 60%);
  background-size: 50px 50px, 50px 50px, 100px 100px;
  animation: circuitMove 20s linear infinite;
}

@keyframes circuitMove {
  0% { transform: translate(0, 0); }
  100% { transform: translate(50px, 50px); }
}

.floating-nodes {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.node {
  position: absolute;
  width: 4px;
  height: 4px;
  background: rgba(0, 122, 255, 0.6);
  border-radius: 50%;
  animation: float 6s ease-in-out infinite;
}

@keyframes float {
  0%, 100% { transform: translateY(0px) scale(1); opacity: 0.6; }
  50% { transform: translateY(-20px) scale(1.2); opacity: 1; }
}

.login-card {
  background: var(--bg-primary);
  backdrop-filter: blur(20px) saturate(180%);
  border-radius: var(--radius-xl);
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-heavy);
  width: 100%;
  max-width: 450px;
  padding: 2.5rem;
  position: relative;
  z-index: 2;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.login-toolbar {
  position: absolute;
  top: 1rem;
  right: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  z-index: 10;
}

.toolbar-btn {
  min-width: auto !important;
  padding: 6px 8px !important;
  font-size: 14px;
  color: var(--text-secondary);
  transition: all 0.2s;
  border-radius: var(--radius-medium);
}

.toolbar-btn:hover {
  color: var(--apple-blue);
  background-color: rgba(0, 122, 255, 0.1);
}

.login-header {
  text-align: center;
  margin-bottom: 2.5rem;
}

.logo-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 2rem;
}

.logo {
  margin-bottom: 1rem;
}

.logo-icon {
  width: 80px;
  height: 80px;
  animation: logoGlow 3s ease-in-out infinite;
}

@keyframes logoGlow {
  0%, 100% { filter: drop-shadow(0 0 10px rgba(0, 122, 255, 0.3)); }
  50% { filter: drop-shadow(0 0 20px rgba(0, 122, 255, 0.6)); }
}

.brand-text {
  text-align: center;
}

.brand-title {
  font-size: 1.75rem;
  font-weight: 700;
  background: linear-gradient(135deg, var(--apple-blue) 0%, var(--apple-purple) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin: 0 0 0.25rem 0;
}

.brand-subtitle {
  color: var(--text-secondary);
  font-size: 0.875rem;
  margin: 0;
  font-weight: 500;
}

.login-title-section {
  border-top: 1px solid var(--border-color);
  padding-top: 1.5rem;
}

.login-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 0.5rem 0;
}

.login-subtitle {
  color: var(--text-secondary);
  margin: 0;
  font-size: 0.875rem;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-label {
  display: flex;
  align-items: center;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 0.5rem;
  gap: 0.5rem;
}

.label-icon {
  width: 1rem;
  height: 1rem;
  fill: var(--text-secondary);
}

.form-input {
  width: 100%;
  padding: 0.875rem 1rem;
  border: 2px solid var(--border-color);
  border-radius: var(--radius-large);
  font-size: 0.875rem;
  transition: all 0.3s;
  box-sizing: border-box;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.form-input:focus {
  outline: none;
  border-color: var(--apple-blue);
  box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.1);
  background: var(--bg-primary);
}

.form-input.error {
  border-color: var(--apple-red);
}

.form-input:disabled {
  background-color: var(--bg-secondary);
  cursor: not-allowed;
}

.password-input-wrapper {
  position: relative;
}

.password-toggle {
  position: absolute;
  right: 1rem;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-secondary);
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-small);
  transition: all 0.2s;
}

.password-toggle:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}

.password-toggle:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.icon {
  width: 1.25rem;
  height: 1.25rem;
  fill: currentColor;
}

.error-message {
  display: block;
  color: var(--apple-red);
  font-size: 0.75rem;
  margin-top: 0.25rem;
  font-weight: 500;
}

.form-options {
  display: flex;
  justify-content: flex-start;
  align-items: center;
  margin-bottom: 2rem;
}

.checkbox-wrapper {
  display: flex;
  align-items: center;
  cursor: pointer;
}

.checkbox {
  margin-right: 0.5rem;
  accent-color: var(--apple-blue);
}

.checkbox-label {
  font-size: 0.875rem;
  color: var(--text-primary);
}

.login-button {
  width: 100%;
  background: var(--apple-blue);
  color: white;
  border: none;
  border-radius: var(--radius-large);
  padding: 1rem;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  box-shadow: var(--shadow-medium);
  min-height: 44px;
}

.login-button:hover:not(:disabled) {
  background: var(--apple-blue-dark);
  transform: translateY(-2px);
  box-shadow: var(--shadow-heavy);
}

.login-button:disabled {
  background: var(--text-disabled);
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.loading-icon {
  width: 1rem;
  height: 1rem;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}



.error-alert {
  display: flex;
  align-items: center;
  background: var(--bg-error);
  border: 1px solid var(--border-error);
  border-radius: var(--radius-large);
  padding: 0.875rem;
  margin-top: 1rem;
  color: var(--apple-red);
  font-size: 0.875rem;
}

.error-icon {
  width: 1.25rem;
  height: 1.25rem;
  margin-right: 0.5rem;
  flex-shrink: 0;
  fill: currentColor;
}

.error-close {
  margin-left: auto;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--apple-red);
  padding: 0.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-small);
  transition: all 0.2s;
}

.error-close:hover {
  color: var(--apple-red);
  background: var(--bg-hover);
}

.error-close svg {
  width: 1rem;
  height: 1rem;
  fill: currentColor;
}

@media (max-width: 640px) {
  .login-container {
    padding: 0.5rem;
  }
  
  .login-card {
    padding: 2rem 1.5rem;
  }
  
  .brand-title {
    font-size: 1.5rem;
  }
  
  .login-title {
    font-size: 1.25rem;
  }
  
  .logo-icon {
    width: 60px;
    height: 60px;
  }
}
</style>