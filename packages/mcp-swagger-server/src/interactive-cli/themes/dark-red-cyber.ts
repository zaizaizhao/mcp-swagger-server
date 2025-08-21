import { Theme, ColorScheme, BorderStyle, IconSet, TableStyle } from './types';

/**
 * 暗红色赛博朋克主题配置
 */

/**
 * 暗红色赛博朋克主题颜色方案
 */
const colors: ColorScheme = {
  primary: '#DC143C',    // 深红色
  secondary: '#8B0000',  // 暗红色
  accent: '#FF6B6B',     // 霓虹红
  success: '#00FF41',    // 霓虹绿
  warning: '#FFD700',    // 金色
  error: '#FF073A',      // 亮红色
  info: '#00BFFF',       // 深天蓝
  muted: '#666666',      // 暗灰
  text: {
    primary: '#FFFFFF',   // 白色
    secondary: '#B0B0B0', // 浅灰
    muted: '#666666',     // 暗灰
    inverse: '#000000'    // 黑色
  },
  background: {
    primary: '#0A0A0A',   // 深黑
    secondary: '#1A1A1A', // 暗灰
    accent: '#2A0A0A'     // 深红黑
  },
  border: {
    primary: '#DC143C',   // 深红色
    secondary: '#8B0000', // 暗红色
    accent: '#FF6B6B'     // 霓虹红
  }
};

/**
 * 赛博朋克图标集
 */
const icons: IconSet = {
  success: '✓',
  warning: '⚠',
  error: '✗',
  info: 'ℹ',
  server: '⚡',
  config: '⚙',
  session: '◉',
  help: '?',
  menu: '▶',
  back: '◀',
  manage: '⚡',
  stats: '📊',
  bullet: '•',
  separator: '│',
  corner: '└',
  line: '─',
  arrow: '→',
  debug: '🔍',
  loading: '⟳',
  edit: '✎',
  delete: '🗑',
  view: '👁',
  create: '✚',
  exit: '⏻',
  rocket: '🚀',
  settings: '⚙',
  welcome: '👋'
};

/**
 * 边框样式配置
 */
const borders: BorderStyle = {
  default: {
    borderStyle: 'single',
    borderColor: '#90EE90',
    padding: 1,
    margin: 1
  },
  accent: {
    borderStyle: 'double',
    borderColor: '#90EE90',
    padding: 1,
    margin: 1
  },
  success: {
    borderStyle: 'single',
    borderColor: '#90EE90',
    padding: 1,
    margin: 1
  },
  error: {
    borderStyle: 'bold',
    borderColor: '#90EE90',
    padding: 1,
    margin: 1
  },
  warning: {
    borderStyle: 'single',
    borderColor: '#90EE90',
    padding: 1,
    margin: 1
  }
};

// 表格样式
const tableStyle: TableStyle = {
  head: [colors.text.primary],
  border: [colors.border.primary],
  style: {
    'padding-left': 1,
    'padding-right': 1,
    head: [colors.accent],
    border: [colors.border.primary],
  },
};

/**
 * 暗红色赛博朋克主题
 */
export const darkRedCyberTheme: Theme = {
  name: 'dark-red-cyber',
  displayName: '暗红赛博',
  description: '未来感暗红色主题，充满科技感',
  colors,
  icons,
  tableStyle,
  borderStyle: borders,
  borders: {
    default: borders.default,
    accent: borders.accent,
    minimal: borders.success
  }
};