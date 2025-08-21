import type { Theme, ColorScheme, IconSet, TableStyle, BorderStyle } from './types';

/**
 * 默认颜色方案
 */
const defaultColors: ColorScheme = {
  primary: 'blue',
  secondary: 'cyan',
  accent: 'magenta',
  success: 'green',
  warning: 'yellow',
  error: 'red',
  info: 'blue',
  muted: 'gray',
  text: {
    primary: 'white',
    secondary: 'gray',
    muted: 'dim',
    inverse: 'black'
  },
  background: {
    primary: 'black',
    secondary: 'gray',
    accent: 'dim'
  },
  border: {
    primary: 'blue',
    secondary: 'cyan',
    accent: 'magenta'
  }
};

/**
 * 默认图标集
 */
const defaultIcons: IconSet = {
  success: '✓',
  warning: '⚠',
  error: '✗',
  info: 'ℹ',
  server: '🚀',
  config: '⚙',
  session: '📋',
  help: '❓',
  menu: '📋',
  back: '←',
  manage: '⚙',
  stats: '📊',
  bullet: '•',
  separator: '|',
  corner: '+',
  line: '-',
  arrow: '→',
  debug: '🔍',
  loading: '⟳',
  edit: '✏',
  delete: '🗑',
  view: '👁',
  create: '➕',
  exit: '🚪',
  rocket: '🚀',
  settings: '⚙',
  welcome: '👋'
};

/**
 * 默认表格样式
 */
const defaultTableStyle: TableStyle = {
  head: ['cyan'],
  border: ['gray'],
  style: {
    'padding-left': 1,
    'padding-right': 1,
    head: ['cyan'],
    border: ['gray']
  }
};

/**
 * 默认边框样式
 */
export const defaultBorders: BorderStyle = {
  default: {
    borderStyle: 'single',
    borderColor: 'gray',
    padding: 1,
    margin: 1
  },
  accent: {
    borderStyle: 'double',
    borderColor: 'blue',
    padding: 1,
    margin: 1
  },
  success: {
    borderStyle: 'single',
    borderColor: 'green',
    padding: 1,
    margin: 1
  },
  error: {
    borderStyle: 'bold',
    borderColor: 'red',
    padding: 1,
    margin: 1
  },
  warning: {
    borderStyle: 'single',
    borderColor: 'yellow',
    padding: 1,
    margin: 1
  }
};

/**
 * 默认主题
 */
export const defaultTheme: Theme = {
  name: 'default',
  displayName: '默认主题',
  description: '经典的默认主题风格',
  colors: defaultColors,
  icons: defaultIcons,
  tableStyle: defaultTableStyle,
  borderStyle: defaultBorders,
  borders: {
    default: defaultBorders.default,
    accent: defaultBorders.accent,
    minimal: defaultBorders.success
  }
};