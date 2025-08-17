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
            <el-menu-item :index="route.path" v-if="!route.meta?.hidden">
              <el-icon>
                <component :is="getIconComponent(route.meta?.icon)" />
              </el-icon>
              <template #title>
                <span>{{
                  $t(`menu.${String(route.name)}`) || route.meta?.title
                }}</span>
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
          :title="sidebarCollapsed ? t('common.expand') : t('common.collapse')"
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
            <el-breadcrumb-item :to="{ path: '/' }">{{
              $t("breadcrumb.home")
            }}</el-breadcrumb-item>
            <el-breadcrumb-item v-if="currentRoute?.meta?.title">
              {{
                $t(`menu.${String(currentRoute.name)}`) ||
                currentRoute.meta.title
              }}
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
              :title="
                systemStatus.isHealthy
                  ? $t('common.healthy')
                  : $t('common.unhealthy')
              "
            />
          </el-badge>

          <!-- 刷新按钮 -->
          <el-button
            :icon="Refresh"
            @click="refreshData"
            text
            :loading="isRefreshing"
            :title="$t('common.refresh')"
          />

          <!-- 语言切换 -->
          <el-dropdown @command="handleLanguageChange" trigger="click">
            <el-button text class="language-btn">
              {{ currentLanguage.flag }} {{ currentLanguage.label }}
              <el-icon class="el-icon--right"><CaretBottom /></el-icon>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item
                  v-for="locale in supportedLocales"
                  :key="locale.value"
                  :command="locale.value"
                  :disabled="locale.value === currentLanguage.value"
                >
                  {{ locale.flag }} {{ locale.label }}
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>

          <!-- 主题切换 -->
          <el-button
            :icon="isDark ? Sunny : Moon"
            @click="toggleTheme"
            text
            :title="isDark ? $t('theme.light') : $t('theme.dark')"
          />

          <!-- 设置按钮 -->
          <el-button
            :icon="Setting"
            @click="openSettings"
            text
            :title="$t('common.settings')"
          />

          <!-- 用户信息 -->
          <el-dropdown
            @command="handleUserAction"
            trigger="click"
            class="user-dropdown"
          >
            <div class="user-info">
              <el-avatar
                :size="32"
                :src="currentUser?.avatar"
                class="user-avatar"
              >
                <el-icon><User /></el-icon>
              </el-avatar>
              <span v-if="!isMobile" class="username">{{
                currentUser?.username
              }}</span>
              <el-icon class="el-icon--right"><CaretBottom /></el-icon>
            </div>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="profile">
                  <el-icon><User /></el-icon>
                  {{ t("userAuth.user.profile") }}
                </el-dropdown-item>
                <el-dropdown-item command="settings">
                  <el-icon><Setting /></el-icon>
                  {{ t("userAuth.user.accountSettings") }}
                </el-dropdown-item>
                <el-dropdown-item divided command="logout">
                  <el-icon><SwitchButton /></el-icon>
                  {{ t("userAuth.user.logout") }}
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
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
import { ref, computed, onMounted, onUnmounted, inject } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import { useI18n } from "vue-i18n";
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
  Moon,
  CaretBottom,
  User,
  SwitchButton,
} from "@element-plus/icons-vue";
import { useAppStore } from "@/stores/app";
import { useThemeStore } from "@/stores/theme";
import { useLocaleStore } from "@/stores/locale";
import { useAuthStore } from "@/stores/auth";
import { SUPPORT_LOCALES, type Locale } from "@/locales";

// 国际化
const { t } = useI18n();

// 全局功能注入
const globalErrorHandler = inject("$globalErrorHandler") as any;

// 简化的性能监控函数
const measureFunction = (
  fn: () => void | Promise<void>,
  name: string,
  metadata?: any,
) => {
  const startTime = performance.now();
  try {
    const result = fn();
    if (result instanceof Promise) {
      return result.finally(() => {
        const duration = performance.now() - startTime;
        console.log(
          `[Performance] ${name}: ${duration.toFixed(2)}ms`,
          metadata,
        );
      });
    } else {
      const duration = performance.now() - startTime;
      console.log(`[Performance] ${name}: ${duration.toFixed(2)}ms`, metadata);
      return result;
    }
  } catch (error) {
    const duration = performance.now() - startTime;
    console.error(
      `[Performance] ${name} failed after ${duration.toFixed(2)}ms`,
      error,
      metadata,
    );
    throw error;
  }
};

// 路由和状态管理
const route = useRoute();
const router = useRouter();
const appStore = useAppStore();
const themeStore = useThemeStore();
const localeStore = useLocaleStore();
const authStore = useAuthStore();

// 响应式状态
const sidebarCollapsed = ref(false);
const isMobile = ref(false);
const isRefreshing = ref(false);

// 系统状态
const systemStatus = ref({
  isHealthy: true,
  errorCount: 0,
  lastUpdate: new Date(),
});

// 计算属性
const activeRoute = computed(() => {
  // 如果当前路由有parent属性，则激活parent对应的菜单项
  if (route.meta?.parent) {
    return route.meta.parent;
  }
  // 否则返回当前路径
  return route.path;
});
const currentRoute = computed(() => route);
const isDark = computed(() => themeStore.isDark);
const currentLanguage = computed(() => localeStore.currentLanguage);
const supportedLocales = computed(() => SUPPORT_LOCALES);
const currentUser = computed(() => authStore.currentUser);

const sidebarWidth = computed(() => {
  if (isMobile.value) {
    return sidebarCollapsed.value ? "0px" : "240px";
  }
  return sidebarCollapsed.value ? "64px" : "240px";
});

// 获取菜单路由
const menuRoutes = computed(() => {
  const mainRoute = router.getRoutes().find((r) => r.path === "/");
  return mainRoute?.children || [];
});

// 图标组件映射
const iconComponents = {
  Monitor,
  Server,
  Document,
  Tools,
  Lock,
  Setting,
  List,
  ChatDotRound,
};

// 方法
const getIconComponent = (iconName?: string | unknown) => {
  if (
    !iconName ||
    typeof iconName !== "string" ||
    !iconComponents[iconName as keyof typeof iconComponents]
  ) {
    return Monitor;
  }
  return iconComponents[iconName as keyof typeof iconComponents];
};

const toggleSidebar = () => {
  sidebarCollapsed.value = !sidebarCollapsed.value;
  // 在移动端，保存侧边栏状态到本地存储
  if (isMobile.value) {
    localStorage.setItem(
      "sidebar-collapsed-mobile",
      String(sidebarCollapsed.value),
    );
  } else {
    localStorage.setItem("sidebar-collapsed", String(sidebarCollapsed.value));
  }
};

const goHome = () => {
  if (route.path !== "/servers") {
    router.push("/servers");
  }
};

const refreshData = async () => {
  isRefreshing.value = true;
  try {
    await measureFunction(
      async () => {
        await appStore.refreshData();
      },
      "layout-refresh-data",
      { currentRoute: route.path },
    );
    ElMessage.success(t("common.refreshSuccess"));
  } catch (error: any) {
    globalErrorHandler?.captureError(error, {
      context: "layout-refresh-data",
      currentRoute: route.path,
      action: "refresh_app_data",
    });
    ElMessage.error(t("common.refreshFailed"));
  } finally {
    isRefreshing.value = false;
  }
};

const toggleTheme = () => {
  try {
    measureFunction(
      () => {
        themeStore.toggleTheme();
      },
      "layout-toggle-theme",
      { newTheme: !themeStore.isDark ? "dark" : "light" },
    );
    ElMessage.success(
      t("theme.switched", {
        theme: themeStore.isDark ? t("theme.dark") : t("theme.light"),
      }),
    );
  } catch (error: any) {
    globalErrorHandler?.captureError(error, {
      context: "layout-toggle-theme",
      action: "theme_toggle",
    });
    ElMessage.error(t("error.operationFailed"));
  }
};

const handleLanguageChange = (locale: Locale) => {
  try {
    measureFunction(
      () => {
        localeStore.changeLocale(locale);
      },
      "layout-change-language",
      { newLocale: locale },
    );
    const language = SUPPORT_LOCALES.find((l) => l.value === locale);
    ElMessage.success(
      t("language.switched", { language: language?.label || locale }),
    );
  } catch (error: any) {
    globalErrorHandler?.captureError(error, {
      context: "layout-change-language",
      action: "language_change",
    });
    ElMessage.error(t("error.operationFailed"));
  }
};

const openSettings = () => {
  try {
    measureFunction(() => {
      // TODO: 实现设置对话框
      ElMessage.info(t("common.info"));
    }, "layout-open-settings");
  } catch (error: any) {
    globalErrorHandler?.captureError(error, {
      context: "layout-open-settings",
      action: "open_settings",
    });
  }
};

const showSystemStatus = () => {
  try {
    if (systemStatus.value.isHealthy) {
      ElMessage.success(
        t("dashboard.systemStatus") + ": " + t("common.healthy"),
      );
    } else {
      ElMessage.warning(
        t("dashboard.systemStatus") + ": " + t("common.unhealthy"),
      );
    }
  } catch (error: any) {
    globalErrorHandler?.captureError(error, {
      context: "layout-show-system-status",
      action: "show_status",
    });
  }
};

// 处理用户操作
const handleUserAction = async (command: string) => {
  try {
    switch (command) {
      case "profile":
        // TODO: 打开个人资料页面
        ElMessage.info(t("userAuth.messages.profileInDevelopment"));
        break;
      case "settings":
        // TODO: 打开账户设置页面
        ElMessage.info(t("userAuth.messages.settingsInDevelopment"));
        break;
      case "logout":
        await measureFunction(async () => {
          await authStore.logout();
          router.push("/login");
        }, "layout-user-logout");
        break;
      default:
        console.warn("Unknown user action:", command);
    }
  } catch (error: any) {
    globalErrorHandler?.captureError(error, {
      context: "layout-user-action",
      action: command,
    });
    ElMessage.error(t("userAuth.errors.operationFailed"));
  }
};

// 检测屏幕尺寸
const checkScreenSize = () => {
  isMobile.value = window.innerWidth < 768;

  // 移动端默认收起侧边栏
  if (isMobile.value) {
    const savedState = localStorage.getItem("sidebar-collapsed-mobile");
    sidebarCollapsed.value = savedState ? savedState === "true" : true;
  } else {
    const savedState = localStorage.getItem("sidebar-collapsed");
    sidebarCollapsed.value = savedState ? savedState === "true" : false;
  }
};

// 更新系统状态
const updateSystemStatus = () => {
  // 这里可以从store或API获取实际的系统状态
  systemStatus.value = {
    isHealthy: appStore.isHealthy,
    errorCount: appStore.systemHealth.errorCount,
    lastUpdate: new Date(),
  };
};

// 生命周期
onMounted(() => {
  checkScreenSize();
  updateSystemStatus();

  // 监听窗口大小变化
  window.addEventListener("resize", checkScreenSize);

  // 定期更新系统状态
  const statusInterval = setInterval(updateSystemStatus, 30000); // 30秒更新一次

  // 清理函数
  onUnmounted(() => {
    window.removeEventListener("resize", checkScreenSize);
    clearInterval(statusInterval);
  });
});
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
  background: linear-gradient(
    90deg,
    rgba(64, 158, 255, 0.1) 0%,
    rgba(64, 158, 255, 0.05) 100%
  );
  color: #409eff;
  transform: translateX(4px);
}

.sidebar-menu .el-menu-item.is-active {
  background: linear-gradient(90deg, #409eff 0%, #337ecc 100%);
  color: white;
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.3);
}

.sidebar-menu .el-menu-item.is-active::before {
  content: "";
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

.language-btn {
  min-width: auto !important;
  padding: 8px 12px !important;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.language-btn .el-icon--right {
  margin-left: 2px !important;
}

/* 用户信息样式 */
.user-dropdown {
  margin-left: 8px;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.user-info:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

.user-avatar {
  flex-shrink: 0;
}

.username {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-info .el-icon--right {
  margin-left: 4px;
  font-size: 12px;
  color: #909399;
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

.dark .user-info:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.dark .username {
  color: #f9fafb;
}

.dark .user-info .el-icon--right {
  color: #9ca3af;
}
</style>
