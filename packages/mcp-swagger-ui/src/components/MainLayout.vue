<template>
  <el-container class="main-layout">
    <!-- 移动端遮罩层 -->
    <div 
      v-if="isMobile && !sidebarCollapsed" 
      class="mobile-overlay"
      @click="toggleSidebar"
    />
    
    <!-- 侧边栏 -->
    <el-aside 
      :width="sidebarWidth" 
      class="sidebar"
      :class="{ 'mobile-sidebar': isMobile }"
    >
      <!-- Logo区域 -->
      <div class="logo" @click="goHome">
        <el-icon v-if="sidebarCollapsed" class="logo-icon">
          <Monitor />
        </el-icon>
        <template v-else>
          <el-icon class="logo-icon">
            <Monitor />
          </el-icon>
          <span class="logo-text">MCP Gateway</span>
        </template>
      </div>
      
      <!-- 导航菜单 -->
      <el-scrollbar class="menu-scrollbar">
        <el-menu
          :default-active="activeRoute"
          class="sidebar-menu"
          :collapse="sidebarCollapsed"
          router
          :unique-opened="true"
        >
          <template v-for="route in menuRoutes" :key="route.name">
            <el-menu-item 
              :index="route.path"
              v-if="!route.meta?.hidden"
            >
              <el-icon>
                <component :is="getIconComponent(route.meta?.icon)" />
              </el-icon>
              <template #title>
                <span>{{ route.meta?.title }}</span>
                <el-tooltip 
                  v-if="route.meta?.description && !sidebarCollapsed"
                  :content="route.meta.description"
                  placement="right"
                >
                  <el-icon class="menu-info">
                    <InfoFilled />
                  </el-icon>
                </el-tooltip>
              </template>
            </el-menu-item>
          </template>
        </el-menu>
      </el-scrollbar>
      
      <!-- 侧边栏底部 -->
      <div class="sidebar-footer">
        <el-button 
          :icon="sidebarCollapsed ? Expand : Fold"
          @click="toggleSidebar"
          text
          class="collapse-btn"
          :title="sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'"
        />
      </div>
    </el-aside>

    <!-- 主内容区域 -->
    <el-container class="main-container">
      <!-- 顶部导航栏 -->
      <el-header class="header">
        <div class="header-left">
          <!-- 移动端菜单按钮 -->
          <el-button 
            v-if="isMobile"
            :icon="Menu" 
            @click="toggleSidebar"
            text
            class="mobile-menu-btn"
          />
          
          <!-- 面包屑导航 -->
          <el-breadcrumb separator="/" class="breadcrumb">
            <el-breadcrumb-item :to="{ path: '/' }">首页</el-breadcrumb-item>
            <el-breadcrumb-item v-if="currentRoute?.meta?.title">
              {{ currentRoute.meta.title }}
            </el-breadcrumb-item>
          </el-breadcrumb>
        </div>
        
        <div class="header-right">
          <!-- 系统状态指示器 -->
          <el-badge 
            :value="systemStatus.errorCount" 
            :hidden="systemStatus.errorCount === 0"
            class="status-badge"
          >
            <el-button 
              :icon="systemStatus.isHealthy ? SuccessFilled : WarningFilled"
              :type="systemStatus.isHealthy ? 'success' : 'warning'"
              text
              @click="showSystemStatus"
              :title="systemStatus.isHealthy ? '系统正常' : '系统异常'"
            />
          </el-badge>
          
          <!-- 刷新按钮 -->
          <el-button 
            :icon="Refresh" 
            @click="refreshData"
            text
            :loading="isRefreshing"
            title="刷新数据"
          />
          
          <!-- 主题切换 -->
          <el-button 
            :icon="isDark ? Sunny : Moon"
            @click="toggleTheme"
            text
            :title="isDark ? '切换到亮色主题' : '切换到暗色主题'"
          />
          
          <!-- 设置按钮 -->
          <el-button 
            :icon="Setting" 
            @click="openSettings"
            text
            title="系统设置"
          />
        </div>
      </el-header>

      <!-- 主内容 -->
      <el-main class="main-content">
        <router-view v-slot="{ Component, route }">
          <transition name="fade-slide" mode="out-in">
            <component :is="Component" :key="route.path" />
          </transition>
        </router-view>
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  Monitor,
  HelpFilled as Server,
  Document,
  Tools,
  Lock,
  Setting,
  List,
  ChatDotRound,
  Expand,
  Fold,
  Refresh,
  Menu,
  InfoFilled,
  SuccessFilled,
  WarningFilled,
  Sunny,
  Moon
} from '@element-plus/icons-vue'
import { useAppStore } from '@/stores/app'
import { useThemeStore } from '@/stores/theme'

// 路由和状态管理
const route = useRoute()
const router = useRouter()
const appStore = useAppStore()
const themeStore = useThemeStore()

// 响应式状态
const sidebarCollapsed = ref(false)
const isMobile = ref(false)
const isRefreshing = ref(false)

// 系统状态
const systemStatus = ref({
  isHealthy: true,
  errorCount: 0,
  lastUpdate: new Date()
})

// 计算属性
const activeRoute = computed(() => route.path)
const currentRoute = computed(() => route)
const isDark = computed(() => themeStore.isDark)

const sidebarWidth = computed(() => {
  if (isMobile.value) {
    return sidebarCollapsed.value ? '0px' : '240px'
  }
  return sidebarCollapsed.value ? '64px' : '240px'
})

// 获取菜单路由
const menuRoutes = computed(() => {
  const mainRoute = router.getRoutes().find(r => r.path === '/')
  return mainRoute?.children || []
})

// 图标组件映射
const iconComponents = {
  Monitor,
  Server,
  Document,
  Tools,
  Lock,
  Setting,
  List,
  ChatDotRound
}

// 方法
const getIconComponent = (iconName?: string) => {
  if (!iconName || !iconComponents[iconName as keyof typeof iconComponents]) {
    return Monitor
  }
  return iconComponents[iconName as keyof typeof iconComponents]
}

const toggleSidebar = () => {
  sidebarCollapsed.value = !sidebarCollapsed.value
  // 在移动端，保存侧边栏状态到本地存储
  if (isMobile.value) {
    localStorage.setItem('sidebar-collapsed-mobile', String(sidebarCollapsed.value))
  } else {
    localStorage.setItem('sidebar-collapsed', String(sidebarCollapsed.value))
  }
}

const goHome = () => {
  if (route.path !== '/dashboard') {
    router.push('/dashboard')
  }
}

const refreshData = async () => {
  isRefreshing.value = true
  try {
    // 刷新应用数据
    await appStore.refreshData()
    ElMessage.success('数据刷新成功')
  } catch (error) {
    console.error('数据刷新失败:', error)
    ElMessage.error('数据刷新失败')
  } finally {
    isRefreshing.value = false
  }
}

const toggleTheme = () => {
  themeStore.toggleTheme()
  ElMessage.success(`已切换到${themeStore.isDark ? '暗色' : '亮色'}主题`)
}

const openSettings = () => {
  // TODO: 实现设置对话框
  ElMessage.info('设置功能开发中...')
}

const showSystemStatus = () => {
  if (systemStatus.value.isHealthy) {
    ElMessage.success('系统运行正常')
  } else {
    ElMessage.warning(`系统存在 ${systemStatus.value.errorCount} 个问题`)
  }
}

// 检测屏幕尺寸
const checkScreenSize = () => {
  isMobile.value = window.innerWidth < 768
  
  // 移动端默认收起侧边栏
  if (isMobile.value) {
    const savedState = localStorage.getItem('sidebar-collapsed-mobile')
    sidebarCollapsed.value = savedState ? savedState === 'true' : true
  } else {
    const savedState = localStorage.getItem('sidebar-collapsed')
    sidebarCollapsed.value = savedState ? savedState === 'true' : false
  }
}

// 更新系统状态
const updateSystemStatus = () => {
  // 这里可以从store或API获取实际的系统状态
  systemStatus.value = {
    isHealthy: appStore.systemHealth.isHealthy,
    errorCount: appStore.systemHealth.errorCount,
    lastUpdate: new Date()
  }
}

// 生命周期
onMounted(() => {
  checkScreenSize()
  updateSystemStatus()
  
  // 监听窗口大小变化
  window.addEventListener('resize', checkScreenSize)
  
  // 定期更新系统状态
  const statusInterval = setInterval(updateSystemStatus, 30000) // 30秒更新一次
  
  // 清理函数
  onUnmounted(() => {
    window.removeEventListener('resize', checkScreenSize)
    clearInterval(statusInterval)
  })
})
</script>

<style scoped>
.main-layout {
  height: 100vh;
  overflow: hidden;
}

/* 移动端遮罩层 */
.mobile-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 1000;
  transition: opacity 0.3s;
}

/* 侧边栏样式 */
.sidebar {
  background: linear-gradient(180deg, #304156 0%, #263445 100%);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.1);
  position: relative;
  z-index: 1001;
}

.mobile-sidebar {
  position: fixed;
  top: 0;
  left: 0;
  height: 100vh;
  z-index: 1001;
}

/* Logo区域 */
.logo {
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 600;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  cursor: pointer;
  transition: background-color 0.3s;
  gap: 12px;
}

.logo:hover {
  background-color: rgba(255, 255, 255, 0.05);
}

.logo-icon {
  font-size: 24px;
  color: #409eff;
}

.logo-text {
  font-size: 18px;
  font-weight: 600;
  letter-spacing: 0.5px;
}

/* 菜单滚动区域 */
.menu-scrollbar {
  height: calc(100vh - 64px - 60px);
}

/* 侧边栏菜单 */
.sidebar-menu {
  border: none;
  background-color: transparent;
  width: 100%;
}

.sidebar-menu .el-menu-item {
  color: rgba(255, 255, 255, 0.8);
  border-radius: 8px;
  margin: 4px 8px;
  transition: all 0.3s;
  position: relative;
}

.sidebar-menu .el-menu-item:hover {
  background: linear-gradient(90deg, rgba(64, 158, 255, 0.1) 0%, rgba(64, 158, 255, 0.05) 100%);
  color: #409eff;
  transform: translateX(4px);
}

.sidebar-menu .el-menu-item.is-active {
  background: linear-gradient(90deg, #409eff 0%, #337ecc 100%);
  color: white;
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.3);
}

.sidebar-menu .el-menu-item.is-active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 4px;
  height: 20px;
  background-color: white;
  border-radius: 0 2px 2px 0;
}

.menu-info {
  margin-left: auto;
  opacity: 0.6;
  font-size: 14px;
}

/* 侧边栏底部 */
.sidebar-footer {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.collapse-btn {
  color: rgba(255, 255, 255, 0.8);
  font-size: 18px;
}

.collapse-btn:hover {
  color: #409eff;
  background-color: rgba(255, 255, 255, 0.1);
}

/* 主容器 */
.main-container {
  flex: 1;
  overflow: hidden;
}

/* 顶部导航栏 */
.header {
  background: linear-gradient(90deg, #ffffff 0%, #f8f9fa 100%);
  border-bottom: 1px solid #e4e7ed;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  position: relative;
  z-index: 100;
}

.header-left,
.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.mobile-menu-btn {
  font-size: 20px;
  margin-right: 8px;
}

.breadcrumb {
  font-size: 14px;
}

.status-badge {
  margin-right: 4px;
}

/* 主内容区域 */
.main-content {
  background-color: #f5f7fa;
  padding: 24px;
  overflow-y: auto;
  height: calc(100vh - 64px);
}

/* 页面切换动画 */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.fade-slide-enter-from {
  opacity: 0;
  transform: translateX(20px);
}

.fade-slide-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .header {
    padding: 0 16px;
  }
  
  .main-content {
    padding: 16px;
  }
  
  .breadcrumb {
    display: none;
  }
  
  .header-right {
    gap: 8px;
  }
  
  .header-right .el-button {
    padding: 8px;
  }
}

@media (max-width: 480px) {
  .header-right {
    gap: 4px;
  }
  
  .main-content {
    padding: 12px;
  }
}

/* 暗色主题支持 */
.dark .sidebar {
  background: linear-gradient(180deg, #1f2937 0%, #111827 100%);
}

.dark .header {
  background: linear-gradient(90deg, #1f2937 0%, #374151 100%);
  border-bottom-color: #374151;
  color: #f9fafb;
}

.dark .main-content {
  background-color: #111827;
  color: #f9fafb;
}

.dark .logo {
  border-bottom-color: rgba(255, 255, 255, 0.1);
}

.dark .sidebar-footer {
  border-top-color: rgba(255, 255, 255, 0.1);
}
</style>