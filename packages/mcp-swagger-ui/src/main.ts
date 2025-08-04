import { createApp } from "vue";
import { createPinia } from "pinia";
import ElementPlus from "element-plus";
import "element-plus/dist/index.css";
import * as ElementPlusIconsVue from "@element-plus/icons-vue";
import App from "./App.vue";
import router from "./router";
import "./assets/styles/main.css";

// Monaco Editor 环境配置
import * as monaco from "monaco-editor";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import jsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
import cssWorker from "monaco-editor/esm/vs/language/css/css.worker?worker";
import htmlWorker from "monaco-editor/esm/vs/language/html/html.worker?worker";
import tsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";

// 配置 Monaco Editor 的 Worker
self.MonacoEnvironment = {
  getWorker(_, label) {
    if (label === "json") {
      return new jsonWorker();
    }
    if (label === "css" || label === "scss" || label === "less") {
      return new cssWorker();
    }
    if (label === "html" || label === "handlebars" || label === "razor") {
      return new htmlWorker();
    }
    if (label === "typescript" || label === "javascript") {
      return new tsWorker();
    }
    return new editorWorker();
  },
};

// 导入全局功能
import { globalErrorHandler } from "./utils/errorHandler";
import { ConfirmationPlugin } from "./composables/useConfirmation";

// 导入国际化
import { i18n, initLocale } from "./locales";

const app = createApp(App);

// 注册所有图标
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component);
}

// 创建 Pinia 实例
const pinia = createPinia();

app.use(pinia);
app.use(router);
app.use(ElementPlus);
app.use(i18n); // 注册i18n

// 注册全局功能
app.use(globalErrorHandler);
app.use(ConfirmationPlugin);

// 初始化应用
async function initializeApp() {
  // 初始化国际化
  initLocale();

  // 动态导入 stores 以避免循环依赖
  const {
    useAppStore,
    useThemeStore,
    useWebSocketStore,
    useLocaleStore,
    useAuthStore,
  } = await import("./stores");

  // 初始化核心 stores
  const appStore = useAppStore();
  const themeStore = useThemeStore();
  const websocketStore = useWebSocketStore();
  const localeStore = useLocaleStore();
  const authStore = useAuthStore();

  // 初始化应用状态
  appStore.initialize();
  themeStore.initialize();
  localeStore.initialize();

  // 初始化认证状态（从本地存储恢复登录状态）
  await authStore.initializeAuth();

  // 初始化 WebSocket 连接（异步）
  websocketStore.initialize().catch((error) => {
    console.warn("WebSocket initialization failed:", error);
  });
}

app.mount("#app");

// 应用挂载后初始化
initializeApp().catch((error) => {
  console.error("App initialization failed:", error);
});
