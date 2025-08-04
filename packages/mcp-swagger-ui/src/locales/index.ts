import { createI18n } from "vue-i18n";
import zhCN from "./zh-CN";
import enUS from "./en-US";

export type Locale = "zh-CN" | "en-US";

// 支持的语言
export const SUPPORT_LOCALES: { value: Locale; label: string; flag: string }[] =
  [
    { value: "zh-CN", label: "简体中文", flag: "🇨🇳" },
    { value: "en-US", label: "English", flag: "🇺🇸" },
  ];

// 创建i18n实例
export const i18n = createI18n({
  legacy: false,
  locale: "zh-CN", // 默认语言
  fallbackLocale: "zh-CN",
  messages: {
    "zh-CN": zhCN,
    "en-US": enUS,
  },
  globalInjection: true,
  silentTranslationWarn: true,
});

// 获取浏览器语言
export function getBrowserLocale(): Locale {
  const browserLang = navigator.language || navigator.languages[0];

  if (browserLang.startsWith("zh")) {
    return "zh-CN";
  }
  if (browserLang.startsWith("en")) {
    return "en-US";
  }

  return "zh-CN"; // 默认
}

// 设置语言
export function setLocale(locale: Locale) {
  i18n.global.locale.value = locale;
  localStorage.setItem("mcp-gateway-locale", locale);

  // 设置HTML lang属性
  document.documentElement.lang = locale;
}

// 加载语言偏好
export function loadLocalePreference(): Locale {
  try {
    const saved = localStorage.getItem("mcp-gateway-locale") as Locale;
    if (saved && SUPPORT_LOCALES.some((l) => l.value === saved)) {
      return saved;
    }
  } catch (error) {
    console.warn("Failed to load locale preference:", error);
  }

  return getBrowserLocale();
}

// 初始化语言
export function initLocale() {
  const locale = loadLocalePreference();
  setLocale(locale);
}

export default i18n;
