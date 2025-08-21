/**
 * 主题系统类型定义
 */

/**
 * 颜色配置接口
 */
export interface ColorScheme {
  // 主要颜色
  primary: string;
  secondary: string;
  accent: string;
  
  // 状态颜色
  success: string;
  warning: string;
  error: string;
  info: string;
  muted: string;
  
  // 文本颜色
  text: {
    primary: string;
    secondary: string;
    muted: string;
    inverse: string;
  };
  
  // 背景颜色
  background: {
    primary: string;
    secondary: string;
    accent: string;
  };
  
  // 边框颜色
  border: {
    primary: string;
    secondary: string;
    accent: string;
  };
}

/**
 * boxen 支持的边框样式类型
 */
export type BoxenBorderStyle = 'single' | 'double' | 'round' | 'bold' | 'singleDouble' | 'doubleSingle' | 'classic' | 'arrow' | 'none';

/**
 * 单个边框样式配置
 */
export interface BorderStyleConfig {
  borderStyle: BoxenBorderStyle;
  borderColor?: string;
  padding?: number;
  margin?: number;
  title?: string;
  titleAlignment?: 'left' | 'center' | 'right';
  backgroundColor?: string;
  dimBorder?: boolean;
}

/**
 * 边框样式集合
 */
export interface BorderStyle {
  default: BorderStyleConfig;
  accent: BorderStyleConfig;
  success: BorderStyleConfig;
  error: BorderStyleConfig;
  warning: BorderStyleConfig;
}

/**
 * 图标集接口
 */
export interface IconSet {
  success: string;
  warning: string;
  error: string;
  info: string;
  server: string;
  config: string;
  session: string;
  help: string;
  menu: string;
  back: string;
  manage: string;
  stats: string;
  bullet: string;
  separator: string;
  corner: string;
  line: string;
  arrow: string;
  debug: string;
  loading: string;
  edit: string;
  delete: string;
  view: string;
  create: string;
  exit: string;
  rocket: string;
  settings: string;
  welcome: string;
}

/**
 * 表格样式配置
 */
export interface TableStyle {
  head: string[];
  border: string[];
  style: {
    'padding-left': number;
    'padding-right': number;
    head: string[];
    border: string[];
  };
}

/**
 * 主题配置接口
 */
export interface Theme {
  name: string;
  displayName: string;
  description: string;
  colors: ColorScheme;
  borders: {
    default: BorderStyleConfig;
    accent: BorderStyleConfig;
    minimal: BorderStyleConfig;
  };
  icons: IconSet;
  tableStyle: TableStyle;
  borderStyle: BorderStyle;
}

/**
 * 主题类型
 */
export type ThemeType = 'default' | 'dark-red-cyber' | 'compact' | 'fancy';

/**
 * 主题管理器接口
 */
export interface IThemeManager {
  getCurrentTheme(): Theme;
  setTheme(themeType: ThemeType): void;
  getAvailableThemes(): ThemeType[];
  registerTheme(themeType: ThemeType, theme: Theme): void;
}