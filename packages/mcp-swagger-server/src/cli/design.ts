import chalk from 'chalk';

const IS_WINDOWS_CMD = process.platform === 'win32' && !process.env.WT_SESSION;

export const CLI_ICONS = IS_WINDOWS_CMD
  ? {
      arrow: '>',
      check: 'OK',
      cross: 'X',
      warning: '!',
      info: 'i',
      loading: 'o',
      rocket: '^',
      config: '#',
      network: '@',
      file: 'F',
      eye: '*',
      clock: 'T',
      stop: 'X',
      wave: '~',
      boom: '*',
      list: '-',
      bulb: '?',
      dollar: '$',
      reload: 'R',
      world: 'W',
      phone: 'P',
      heart: '<3',
      star: '*',
      bug: 'B',
      chat: 'C',
      api: 'A',
      title: 'T',
      version: 'V',
      web: 'W',
      link: 'L',
      signal: 'S',
      bolt: '!',
      gear: 'G',
      process: 'P',
      up: '^',
      key: 'K',
    }
  : {
      arrow: '▶',
      check: '✓',
      cross: '✗',
      warning: '⚠',
      info: 'ℹ',
      loading: '◯',
      rocket: '🚀',
      config: '📋',
      network: '📡',
      file: '📁',
      eye: '👁️',
      clock: '🕒',
      stop: '🛑',
      wave: '👋',
      boom: '💥',
      list: '📋',
      bulb: '💡',
      dollar: '$',
      reload: '🔄',
      world: '🌍',
      phone: '📞',
      heart: '❤️',
      star: '⭐',
      bug: '🐛',
      chat: '💬',
      api: '🛣️',
      title: '📝',
      version: '🔖',
      web: '🌐',
      link: '🔗',
      signal: '📡',
      bolt: '⚡',
      gear: '🔧',
      process: '🔄',
      up: '🛑',
      key: '🔐',
    };

export class CliDesign {
  static readonly brand = {
    primary: chalk.hex('#00D4FF'),
    secondary: chalk.hex('#FF6B6B'),
    success: chalk.hex('#4ECDC4'),
    warning: chalk.hex('#FFE66D'),
    error: chalk.hex('#FF6B6B'),
    info: chalk.hex('#A8E6CF'),
    muted: chalk.hex('#95A5A6'),
    white: chalk.white,
    bold: chalk.bold,
  };

  static readonly icons = CLI_ICONS;

  static gradient(text: string, colors: string[] = ['#00D4FF', '#4ECDC4']): string {
    const chars = text.split('');
    const step = (colors.length - 1) / (chars.length - 1);
    
    return chars.map((char, i) => {
      const colorIndex = Math.floor(i * step);
      return chalk.hex(colors[colorIndex])(char);
    }).join('');
  }

  static banner(title: string): string {
    const width = 60;
    const titleLength = title.length;
    const padding = Math.max(0, Math.floor((width - titleLength - 4) / 2));
    
    const line = this.brand.primary('='.repeat(width));
    const emptyLine = this.brand.primary('|') + ' '.repeat(width - 2) + this.brand.primary('|');
    const titleLine = this.brand.primary('|') + ' '.repeat(padding) + 
                     this.brand.bold.white(title) + 
                     ' '.repeat(width - titleLength - padding - 2) + this.brand.primary('|');

    return [
      line,
      emptyLine,
      titleLine,
      emptyLine,
      line
    ].join('\n');
  }

  static section(title: string): string {
    return '\n' + this.brand.primary.bold(`${this.icons.arrow} ${title}`) + '\n' + this.brand.muted('-'.repeat(title.length + 2));
  }

  static option(flag: string, description: string, defaultValue?: string): string {
    const flagFormatted = this.brand.secondary.bold(flag.padEnd(20));
    const desc = this.brand.white(description);
    const def = defaultValue ? this.brand.muted(` [默认: ${defaultValue}]`) : '';
    return `  ${flagFormatted} ${desc}${def}`;
  }

  static example(command: string, description: string): string {
    return `  ${this.brand.success(this.icons.dollar)} ${this.brand.info(command)}\n  ${this.brand.muted('  ' + description)}`;
  }

  static success(message: string): string {
    return this.brand.success(this.icons.check) + ' ' + this.brand.white(message);
  }

  static error(message: string): string {
    return this.brand.error(this.icons.cross) + ' ' + this.brand.white(message);
  }

  static warning(message: string): string {
    return this.brand.warning(this.icons.warning) + ' ' + this.brand.white(message);
  }

  static info(message: string): string {
    return this.brand.info(this.icons.info) + ' ' + this.brand.white(message);
  }

  static loading(message: string): string {
    return this.brand.primary(this.icons.loading) + ' ' + this.brand.white(message);
  }

  static progress(current: number, total: number, label: string = ''): string {
    const percentage = Math.round((current / total) * 100);
    const barLength = 20;
    const filledLength = Math.round((current / total) * barLength);
    
    const filled = this.brand.success('#'.repeat(filledLength));
    const empty = this.brand.muted('-'.repeat(barLength - filledLength));
    const percent = this.brand.bold.white(`${percentage}%`);
    const labelText = label ? this.brand.muted(` ${label}`) : '';
    
    return `${filled}${empty} ${percent}${labelText}`;
  }

  static tableRow(items: string[], colors: ((text: string) => string)[] = []): string {
    return items.map((item, i) => {
      const color = colors[i] || this.brand.white;
      return color(item.padEnd(20));
    }).join(' ');
  }

  static showHeader(title: string): void {
    console.clear();
    console.log(this.banner(title));
  }

  static separator(char: string = '-', length: number = 50): string {
    return this.brand.muted(char.repeat(length));
  }
}
