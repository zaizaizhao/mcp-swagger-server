import Table from 'cli-table3';
import { ApiEndpoint } from 'mcp-swagger-parser';
import { InterfaceSelectionOptions } from './interface-selector';

export interface FormattedChoice {
  name: string;
  value: string;
  short?: string;
  disabled?: boolean | string;
}

/**
 * 接口显示格式化器 - 负责将接口信息格式化为用户友好的显示格式
 */
export class InterfaceDisplayFormatter {
  constructor(private options: InterfaceSelectionOptions = {}) {}

  /**
   * 创建可选择的接口表格
   */
  createSelectableInterfaceTable(endpoints: ApiEndpoint[], selectedIndices: Set<number>, style: 'compact' | 'detailed' = 'compact'): any {
    const table = new Table(this.getSelectableTableConfig(style));
    
    endpoints.forEach((endpoint, index) => {
      const row = this.formatSelectableTableRow(endpoint, index, selectedIndices.has(index), style);
      table.push(row);
    });
    
    return table;
  }

  /**
   * 获取可选择表格配置
   */
  private getSelectableTableConfig(style: 'compact' | 'detailed'): any {
    // 获取终端宽度，默认120字符
    const terminalWidth = process.stdout.columns || 120;
    
    // 根据终端宽度动态调整列宽
    let colWidths: number[];
    if (terminalWidth < 100) {
      // 窄终端：紧凑布局
      colWidths = [6, 4, 8, 25, 30];
    } else if (terminalWidth < 140) {
      // 中等终端：标准布局
      colWidths = [8, 5, 12, 35, 45];
    } else {
      // 宽终端：宽松布局
      colWidths = [10, 6, 14, 45, 60];
    }
    
    const baseConfig = {
      head: ['选择', '序号', 'HTTP方法', '路径', '描述'],
      colWidths,
      style: {
        head: ['cyan', 'bold'],
        border: ['grey']
      },
      chars: {
        'top': '═',
        'top-mid': '╤',
        'top-left': '╔',
        'top-right': '╗',
        'bottom': '═',
        'bottom-mid': '╧',
        'bottom-left': '╚',
        'bottom-right': '╝',
        'left': '║',
        'left-mid': '╟',
        'mid': '─',
        'mid-mid': '┼',
        'right': '║',
        'right-mid': '╢',
        'middle': '│'
      }
    };
    
    if (style === 'detailed') {
      baseConfig.head.push('标签', '状态');
      if (terminalWidth < 100) {
        baseConfig.colWidths.push(15, 8);
      } else if (terminalWidth < 140) {
        baseConfig.colWidths.push(18, 10);
      } else {
        baseConfig.colWidths.push(22, 12);
      }
    }
    
    return baseConfig;
  }

  /**
   * 格式化可选择表格行
   */
  private formatSelectableTableRow(endpoint: ApiEndpoint, index: number, isSelected: boolean, style: 'compact' | 'detailed'): any[] {
    const selectIcon = isSelected ? '✅ 已选' : '⬜ 未选';
    
    // 获取终端宽度以动态调整截断长度
    const terminalWidth = process.stdout.columns || 120;
    let pathMaxLength: number, descMaxLength: number, tagsMaxLength: number;
    
    if (terminalWidth < 100) {
      pathMaxLength = 22;
      descMaxLength = 25;
      tagsMaxLength = 12;
    } else if (terminalWidth < 140) {
      pathMaxLength = 32;
      descMaxLength = 40;
      tagsMaxLength = 15;
    } else {
      pathMaxLength = 42;
      descMaxLength = 55;
      tagsMaxLength = 18;
    }
    
    const row = [
      selectIcon,
      (index + 1).toString(),
      this.getMethodBadge(endpoint.method),
      this.truncateText(endpoint.path, pathMaxLength),
      this.truncateText(endpoint.summary || endpoint.description || '无描述', descMaxLength)
    ];
    
    if (style === 'detailed') {
      const tags = endpoint.tags?.join(', ') || '无标签';
      const status = endpoint.deprecated ? '⚠️ 已弃用' : '✅ 正常';
      row.push(this.truncateText(tags, tagsMaxLength));
      row.push(status);
    }
    
    return row;
  }



  /**
   * 获取 HTTP 方法的颜色代码
   */
  private getMethodColor(method: string): string {
    const colors = {
      'get': '\x1b[32m',      // 绿色
      'post': '\x1b[33m',     // 黄色
      'put': '\x1b[34m',      // 蓝色
      'delete': '\x1b[31m',   // 红色
      'patch': '\x1b[35m',    // 紫色
      'head': '\x1b[36m',     // 青色
      'options': '\x1b[37m'   // 白色
    };
    return colors[method.toLowerCase() as keyof typeof colors] || '\x1b[0m';
  }

  /**
   * 获取 HTTP 方法的徽章
   */
  private getMethodBadge(method: string): string {
    const badges = {
      'get': '🟢 GET',
      'post': '🟡 POST',
      'put': '🔵 PUT',
      'delete': '🔴 DELETE',
      'patch': '🟣 PATCH',
      'head': '🔵 HEAD',
      'options': '⚪ OPTIONS'
    };
    return badges[method.toLowerCase() as keyof typeof badges] || `⚫ ${method.toUpperCase()}`;
  }

  /**
   * 创建接口详情表格
   */
  createInterfaceTable(endpoints: ApiEndpoint[], style: 'compact' | 'detailed' | 'minimal' = 'detailed'): any {
    const tableConfig = this.getTableConfig(style);
    const table = new Table(tableConfig);

    endpoints.forEach((endpoint, index) => {
      const row = this.formatTableRow(endpoint, index + 1, style);
      table.push(row);
    });

    return table;
  }

  /**
   * 获取表格配置
   */
  private getTableConfig(style: 'compact' | 'detailed' | 'minimal'): any {
    const baseConfig = {
      style: {
        head: ['cyan', 'bold'],
        border: ['grey']
      }
    };

    switch (style) {
      case 'compact':
        return {
          ...baseConfig,
          head: ['#', '方法', '路径', '状态'],
          colWidths: [4, 8, 50, 8],
          chars: {
            'top': '─', 'top-mid': '┬', 'top-left': '┌', 'top-right': '┐',
            'bottom': '─', 'bottom-mid': '┴', 'bottom-left': '└', 'bottom-right': '┘',
            'left': '│', 'left-mid': '├', 'mid': '─', 'mid-mid': '┼',
            'right': '│', 'right-mid': '┤', 'middle': '│'
          }
        };

      case 'detailed':
        const terminalWidth = process.stdout.columns || 120;
        let detailedColWidths: number[];
        
        if (terminalWidth < 100) {
          detailedColWidths = [4, 8, 25, 30, 15, 8];
        } else if (terminalWidth < 140) {
          detailedColWidths = [5, 10, 30, 35, 18, 10];
        } else {
          detailedColWidths = [6, 12, 40, 45, 22, 12];
        }
        
        return {
          ...baseConfig,
          head: ['序号', 'HTTP方法', '路径', '描述', '标签', '状态'],
          colWidths: detailedColWidths,
          chars: {
            'top': '═', 'top-mid': '╤', 'top-left': '╔', 'top-right': '╗',
            'bottom': '═', 'bottom-mid': '╧', 'bottom-left': '╚', 'bottom-right': '╝',
            'left': '║', 'left-mid': '╟', 'mid': '─', 'mid-mid': '┼',
            'right': '║', 'right-mid': '╢', 'middle': '│'
          }
        };

      case 'minimal':
        return {
          ...baseConfig,
          head: ['方法', '路径'],
          colWidths: [10, 60],
          chars: {
            'top': '', 'top-mid': '', 'top-left': '', 'top-right': '',
            'bottom': '', 'bottom-mid': '', 'bottom-left': '', 'bottom-right': '',
            'left': '', 'left-mid': '', 'mid': '', 'mid-mid': '',
            'right': '', 'right-mid': '', 'middle': ' '
          }
        };

      default:
        return baseConfig;
    }
  }

  /**
   * 格式化表格行
   */
  private formatTableRow(endpoint: ApiEndpoint, index: number, style: 'compact' | 'detailed' | 'minimal'): string[] {
    const methodColor = this.getMethodColor(endpoint.method);
    const method = `${methodColor}${endpoint.method.toUpperCase()}\x1b[0m`;
    const status = endpoint.deprecated ? '🚫 已废弃' : '✅ 正常';

    switch (style) {
      case 'compact':
        return [
          index.toString(),
          method,
          this.truncateText(endpoint.path, 45),
          status
        ];

      case 'detailed':
        const terminalWidth = process.stdout.columns || 120;
        let pathLen: number, descLen: number, tagsLen: number;
        
        if (terminalWidth < 100) {
          pathLen = 22; descLen = 25; tagsLen = 12;
        } else if (terminalWidth < 140) {
          pathLen = 27; descLen = 30; tagsLen = 15;
        } else {
          pathLen = 37; descLen = 40; tagsLen = 18;
        }
        
        const description = this.truncateText(endpoint.summary || endpoint.description || '无描述', descLen);
        const tags = endpoint.tags?.join(', ') || '无标签';
        return [
          index.toString(),
          method,
          this.truncateText(endpoint.path, pathLen),
          description,
          this.truncateText(tags, tagsLen),
          status
        ];

      case 'minimal':
        return [
          method,
          endpoint.path
        ];

      default:
        return [method, endpoint.path];
    }
  }

  /**
   * 显示接口统计信息
   */
  displayInterfaceStats(endpoints: ApiEndpoint[]): void {
    const stats = this.calculateStats(endpoints);
    
    console.log('\n📊 接口统计信息:');
    console.log(`总接口数: ${stats.total}`);
    console.log(`HTTP方法分布:`);
    
    Object.entries(stats.methods).forEach(([method, count]) => {
      const methodColor = this.getMethodColor(method);
      console.log(`  ${methodColor}${method.toUpperCase()}\x1b[0m: ${count} 个`);
    });
    
    if (stats.deprecated > 0) {
      console.log(`🚫 已废弃接口: ${stats.deprecated} 个`);
    }
    
    if (stats.tags.length > 0) {
      console.log(`🏷️  标签: ${stats.tags.join(', ')}`);
    }
    
    console.log('');
  }

  /**
   * 计算接口统计信息
   */
  private calculateStats(endpoints: ApiEndpoint[]): {
    total: number;
    methods: { [key: string]: number };
    deprecated: number;
    tags: string[];
  } {
    const methods: { [key: string]: number } = {};
    const tagsSet = new Set<string>();
    let deprecated = 0;

    endpoints.forEach(endpoint => {
      // 统计HTTP方法
      const method = endpoint.method.toLowerCase();
      methods[method] = (methods[method] || 0) + 1;

      // 统计废弃接口
      if (endpoint.deprecated) {
        deprecated++;
      }

      // 收集标签
      endpoint.tags?.forEach(tag => tagsSet.add(tag));
    });

    return {
      total: endpoints.length,
      methods,
      deprecated,
      tags: Array.from(tagsSet)
    };
  }

  /**
   * 截断文本
   */
  private truncateText(text: string, maxLength: number): string {
    if (!text || text.length <= maxLength) {
      return text || '';
    }
    
    // 确保最小长度为4（至少能显示一个字符和省略号）
    if (maxLength < 4) {
      return text.substring(0, maxLength);
    }
    
    return text.substring(0, maxLength - 3) + '...';
  }
}