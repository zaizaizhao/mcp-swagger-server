import type { Theme, ThemeType, IThemeManager } from './types';
import { defaultTheme } from './default';
import { darkRedCyberTheme } from './dark-red-cyber';



/**
 * 主题管理器实现
 */
export class ThemeManager implements IThemeManager {
  private themes: Map<ThemeType, Theme> = new Map();
  private currentThemeName: ThemeType = 'dark-red-cyber'; // 默认使用暗红色主题

  constructor() {
    // 注册默认主题
    this.registerTheme('default', defaultTheme);
    
    // 注册暗红色赛博朋克主题
    this.registerTheme('dark-red-cyber', darkRedCyberTheme);
    
    // 设置默认主题为暗红色
    this.currentThemeName = 'dark-red-cyber';
  }

  /**
   * 获取当前主题
   */
  getCurrentTheme(): Theme {
    const theme = this.themes.get(this.currentThemeName);
    if (!theme) {
      console.warn(`主题 ${this.currentThemeName} 未找到，使用默认主题`);
      return this.themes.get('default') || defaultTheme;
    }
    return theme;
  }

  /**
   * 检查主题是否存在
   */
  hasTheme(themeType: ThemeType): boolean {
    return this.themes.has(themeType);
  }

  /**
   * 设置当前主题
   */
  setTheme(themeType: ThemeType): void {
    if (!this.themes.has(themeType)) {
      throw new Error(`主题 ${themeType} 未注册`);
    }
    this.currentThemeName = themeType;
  }

  /**
   * 获取所有可用主题
   */
  getAvailableThemes(): ThemeType[] {
    return Array.from(this.themes.keys());
  }

  /**
   * 注册新主题
   */
  registerTheme(themeType: ThemeType, theme: Theme): void {
    this.themes.set(themeType, theme);
  }

  /**
   * 获取主题显示信息
   */
  getThemeInfo(themeType: ThemeType): { displayName: string; description: string } | null {
    const theme = this.themes.get(themeType);
    if (!theme) return null;
    
    return {
      displayName: theme.displayName,
      description: theme.description,
    };
  }

  /**
   * 获取当前主题类型
   */
  getCurrentThemeType(): ThemeType {
    return this.currentThemeName;
  }
}

// 导出单例实例
export const themeManager = new ThemeManager();