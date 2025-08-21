import inquirer from 'inquirer';
import { emitKeypressEvents } from 'readline';
import { OpenAPISpec, OperationObject, EndpointExtractor, ApiEndpoint } from 'mcp-swagger-parser';
import { OperationFilter } from '../types';
import { InterfaceDisplayFormatter } from './interface-display-formatter';
import { SelectionConverter } from './selection-converter';
import { EndpointFilter } from '../../utils/endpoint-filter';
import * as readline from 'readline';

/**
 * 用户取消操作错误
 */
export class UserCancelledError extends Error {
  constructor(message: string = '用户取消了操作') {
    super(message);
    this.name = 'UserCancelledError';
  }
}

export interface InterfaceSelectionOptions {
  enableSearch?: boolean;
  enablePagination?: boolean;
  pageSize?: number;
  groupByTags?: boolean;
  showDeprecated?: boolean;
}

export interface InterfaceSelectionResult {
  operationFilter: OperationFilter;
  selectedCount: number;
  totalCount: number;
  selectionMode: 'include' | 'exclude' | 'tags' | 'patterns';
  // 选择的具体信息
  selectedEndpoints?: string[]; // 格式: "METHOD:path"
  selectedTags?: string[];
  pathPatterns?: string[];
}

/**
 * 接口选择器 - 提供交互式接口选择功能
 */
export class InterfaceSelector {
  private formatter: InterfaceDisplayFormatter;
  private converter: SelectionConverter;
  private endpoints: ApiEndpoint[];

  constructor(
    private spec: OpenAPISpec,
    private options: InterfaceSelectionOptions = {},
    private filterOptions: {
      includeDeprecated?: boolean;
      includeTags?: string[];
      excludeTags?: string[];
    } = {}
  ) {
    // 提取所有接口，但应用与transformToMCPTools相同的基础过滤逻辑
    const allEndpoints = EndpointExtractor.extractEndpoints(spec);
    this.endpoints = EndpointFilter.filterEndpoints(allEndpoints, this.filterOptions);
    this.formatter = new InterfaceDisplayFormatter(this.options);
    this.converter = new SelectionConverter();
  }

  /**
   * 启动接口选择流程
   */
  async selectInterfaces(): Promise<InterfaceSelectionResult> {
    console.log(`\n📋 发现 ${this.endpoints.length} 个 API 接口\n`);

    try {
      // 1. 选择选择模式
      const selectionMode = await this.chooseSelectionMode();
      
      // 2. 根据模式执行选择
      let operationFilter: OperationFilter;
      let selectedCount: number;
      let selectedEndpoints: string[] = [];
      let selectedTags: string[] = [];
      let pathPatterns: string[] = [];

      switch (selectionMode) {
        case 'include':
          const includeResult = await this.selectByInclusion();
          operationFilter = includeResult.filter;
          selectedCount = includeResult.count;
          selectedEndpoints = includeResult.selectedEndpoints;
          break;
          
        case 'exclude':
          const excludeResult = await this.selectByExclusion();
          operationFilter = excludeResult.filter;
          selectedCount = this.endpoints.length - excludeResult.count;
          selectedEndpoints = excludeResult.selectedEndpoints;
          break;
          
        case 'tags':
          const tagsResult = await this.selectByTags();
          operationFilter = tagsResult.filter;
          selectedCount = tagsResult.count;
          selectedTags = tagsResult.selectedTags;
          break;
          
        case 'patterns':
          const patternsResult = await this.selectByPatterns();
          operationFilter = patternsResult.filter;
          selectedCount = patternsResult.count;
          pathPatterns = patternsResult.pathPatterns;
          break;
          
        default:
          throw new Error(`Unsupported selection mode: ${selectionMode}`);
      }

      // 3. 显示选择结果摘要
      this.displaySelectionSummary(selectedCount, selectionMode);

      return {
        operationFilter,
        selectedCount,
        totalCount: this.endpoints.length,
        selectionMode,
        selectedEndpoints,
        selectedTags,
        pathPatterns
      };
    } catch (error) {
      if (error instanceof UserCancelledError) {
        console.log('\n❌ 操作已取消');
        // 返回一个表示取消操作的结果
        return {
          operationFilter: {},
          selectedCount: 0,
          totalCount: this.endpoints.length,
          selectionMode: 'include',
          selectedEndpoints: [],
          selectedTags: [],
          pathPatterns: []
        };
      }
      // 重新抛出其他类型的错误
      throw error;
    }
  }

  /**
   * 选择选择模式
   */
  private async chooseSelectionMode(): Promise<'include' | 'exclude' | 'tags' | 'patterns'> {
    const { mode } = await inquirer.prompt([{
      type: 'list',
      name: 'mode',
      message: '选择接口选择模式:',
      choices: [
        {
          name: '✅ 选择要包含的接口 - 只转换选中的接口',
          value: 'include'
        },
        {
          name: '❌ 选择要排除的接口 - 转换除选中外的所有接口',
          value: 'exclude'
        },
        {
          name: '🏷️  按标签选择 - 根据 API 标签选择',
          value: 'tags'
        },
        {
          name: '🔍 按路径模式选择 - 使用通配符模式选择',
          value: 'patterns'
        }
      ]
    }]);

    return mode;
  }

  /**
   * 包含模式选择
   */
  private async selectByInclusion(): Promise<{ filter: OperationFilter; count: number; selectedEndpoints: string[] }> {
    const selectedIndices = await this.selectInterfacesFromTable('选择要包含的接口');
    
    if (selectedIndices.length === 0) {
      throw new UserCancelledError('用户取消了接口选择操作');
    }

    const selectedEndpoints = selectedIndices.map(index => this.endpoints[index]);
    const selected = selectedEndpoints.map(endpoint => `${endpoint.method}:${endpoint.path}`);
    
    const filter = this.converter.convertIncludeSelection(selected, this.endpoints);
    return { filter, count: selected.length, selectedEndpoints: selected };
  }

  /**
   * 排除模式选择
   */
  private async selectByExclusion(): Promise<{ filter: OperationFilter; count: number; selectedEndpoints: string[] }> {
    const selectedIndices = await this.selectInterfacesFromTable('选择要排除的接口');
    
    const selectedEndpoints = selectedIndices.map(index => this.endpoints[index]);
    const selected = selectedEndpoints.map(endpoint => `${endpoint.method}:${endpoint.path}`);
    
    const filter = this.converter.convertExcludeSelection(selected, this.endpoints);
    return { filter, count: selected.length, selectedEndpoints: selected };
  }

  /**
   * 按标签选择
   */
  private async selectByTags(): Promise<{ filter: OperationFilter; count: number; selectedTags: string[] }> {
    // 提取所有标签
    const allTags = new Set<string>();
    this.endpoints.forEach(endpoint => {
      endpoint.tags?.forEach(tag => allTags.add(tag));
    });

    if (allTags.size === 0) {
      console.log('⚠️  未发现任何标签，将使用包含模式');
      const result = await this.selectByInclusion();
      return { filter: result.filter, count: result.count, selectedTags: [] };
    }

    const tagChoices = Array.from(allTags).map(tag => {
      const count = this.endpoints.filter(e => e.tags?.includes(tag)).length;
      return {
        name: `${tag} (${count} 个接口)`,
        value: tag
      };
    });

    const { selectedTags } = await inquirer.prompt([{
      type: 'checkbox',
      name: 'selectedTags',
      message: '选择要包含的标签:',
      choices: tagChoices,
      validate: (input: string[]) => {
        if (input.length === 0) {
          return '请至少选择一个标签';
        }
        return true;
      }
    }]);

    const filter = this.converter.convertTagsSelection(selectedTags);
    const count = this.endpoints.filter(e => 
      e.tags?.some(tag => selectedTags.includes(tag))
    ).length;
    
    return { filter, count, selectedTags };
  }

  /**
   * 按路径模式选择
   */
  private async selectByPatterns(): Promise<{ filter: OperationFilter; count: number; pathPatterns: string[] }> {
    console.log('\n💡 路径模式支持通配符:');
    console.log('  * 匹配任意字符');
    console.log('  /api/users/* 匹配 /api/users/ 下的所有路径');
    console.log('  */admin/* 匹配包含 /admin/ 的所有路径\n');

    const { patterns } = await inquirer.prompt([{
      type: 'input',
      name: 'patterns',
      message: '输入路径模式 (用逗号分隔多个模式):',
      validate: (input: string) => {
        if (!input.trim()) {
          return '请输入至少一个路径模式';
        }
        return true;
      }
    }]);

    const patternList = patterns.split(',').map((p: string) => p.trim()).filter(Boolean);
    const filter = this.converter.convertPatternsSelection(patternList);
    
    // 计算匹配的接口数量
    const count = this.endpoints.filter(endpoint => 
      patternList.some((pattern: string) => this.matchesPattern(endpoint.path, pattern))
    ).length;

    console.log(`\n✅ 匹配到 ${count} 个接口`);
    return { filter, count, pathPatterns: patternList };
  }

  /**
   * 分页选择（用于大量接口的情况）
   */
  private async selectWithPagination(
    choices: any[], 
    mode: 'include' | 'exclude'
  ): Promise<{ filter: OperationFilter; count: number; selectedEndpoints: string[] }> {
    const pageSize = this.options.pageSize || 20;
    const totalPages = Math.ceil(this.endpoints.length / pageSize);
    const allSelectedIndices = new Set<number>();
    let currentPage = 0;

    while (currentPage < totalPages) {
      const start = currentPage * pageSize;
      const end = Math.min(start + pageSize, this.endpoints.length);
      const pageEndpoints = this.endpoints.slice(start, end);

      console.log(`\n📄 第 ${currentPage + 1}/${totalPages} 页 (${start + 1}-${end}/${this.endpoints.length})`);
      
      // 显示当前页的表格
      this.formatter.displayInterfaceStats(pageEndpoints);
      const pageSelectedIndices = new Set<number>();
      
      // 将全局选择状态映射到当前页
      for (let i = 0; i < pageEndpoints.length; i++) {
        const globalIndex = start + i;
        if (allSelectedIndices.has(globalIndex)) {
          pageSelectedIndices.add(i);
        }
      }
      
      const table = this.formatter.createSelectableInterfaceTable(pageEndpoints, pageSelectedIndices, 'detailed');
      console.log(table.toString());
      
      console.log(`\n当前页已选择: ${pageSelectedIndices.size} 个接口`);
      console.log(`总计已选择: ${allSelectedIndices.size} 个接口`);
      
      // 显示操作提示
      console.log('\n操作说明:');
      console.log('  输入序号选择/取消选择接口 (如: 1,3,5-8)');
      console.log('  输入 "all" 全选当前页所有接口');
      console.log('  输入 "clear" 清空当前页所有选择');
      console.log('  输入 "next" 进入下一页');
      console.log('  输入 "prev" 返回上一页');
      console.log('  输入 "done" 完成选择');
      console.log('  输入 "cancel" 取消操作');
      
      const { action } = await inquirer.prompt([{
        type: 'input',
        name: 'action',
        message: `选择操作 (第${currentPage + 1}页):`,
        validate: (input: string) => {
          const trimmed = input.trim().toLowerCase();
          if (['all', 'clear', 'next', 'prev', 'done', 'cancel'].includes(trimmed)) {
            return true;
          }
          
          // 验证序号格式
          const isValidFormat = /^\d+([-,]\d+)*$/.test(trimmed.replace(/\s/g, ''));
          if (!isValidFormat && trimmed !== '') {
            return '请输入有效的序号格式 (如: 1,3,5-8) 或操作命令';
          }
          
          return true;
        }
      }]);

      const command = action.trim().toLowerCase();
      
      switch (command) {
        case 'all':
          // 全选当前页
          for (let i = 0; i < pageEndpoints.length; i++) {
            const globalIndex = start + i;
            allSelectedIndices.add(globalIndex);
          }
          console.log(`✅ 已全选当前页 ${pageEndpoints.length} 个接口`);
          break;
          
        case 'clear':
          // 清空当前页选择
          for (let i = 0; i < pageEndpoints.length; i++) {
            const globalIndex = start + i;
            allSelectedIndices.delete(globalIndex);
          }
          console.log('🗑️  已清空当前页所有选择');
          break;
          
        case 'next':
          if (currentPage < totalPages - 1) {
            currentPage++;
          } else {
            console.log('⚠️  已经是最后一页');
          }
          break;
          
        case 'prev':
          if (currentPage > 0) {
            currentPage--;
          } else {
            console.log('⚠️  已经是第一页');
          }
          break;
          
        case 'done':
          // 完成选择
          currentPage = totalPages; // 退出循环
          break;
          
        case 'cancel':
          // 取消操作
          allSelectedIndices.clear();
          currentPage = totalPages; // 退出循环
          break;
          
        default:
          // 处理序号选择
          if (command) {
            this.processPageIndexSelection(command, pageSelectedIndices, allSelectedIndices, start, pageEndpoints.length);
          }
          break;
      }
    }

    // 转换选择结果
    const selectedEndpoints = Array.from(allSelectedIndices).map(index => this.endpoints[index]);
    const selectedValues = selectedEndpoints.map(endpoint => `${endpoint.method}:${endpoint.path}`);
    
    const filter = mode === 'include' 
      ? this.converter.convertIncludeSelection(selectedValues, this.endpoints)
      : this.converter.convertExcludeSelection(selectedValues, this.endpoints);
    
    return { filter, count: allSelectedIndices.size, selectedEndpoints: selectedValues };
  }

  /**
   * 显示选择结果摘要
   */
  private displaySelectionSummary(selectedCount: number, mode: string): void {
    console.log('\n📊 选择结果摘要:');
    console.log(`总接口数: ${this.endpoints.length}`);
    console.log(`选择模式: ${this.getModeDisplayName(mode)}`);
    
    if (mode === 'exclude') {
      console.log(`排除接口: ${this.endpoints.length - selectedCount}`);
      console.log(`将转换接口: ${selectedCount}`);
    } else {
      console.log(`选择接口: ${selectedCount}`);
      console.log(`将转换接口: ${selectedCount}`);
    }
  }

  /**
   * 获取模式显示名称
   */
  private getModeDisplayName(mode: string): string {
    const modeNames = {
      'include': '包含模式',
      'exclude': '排除模式', 
      'tags': '标签模式',
      'patterns': '模式匹配'
    };
    return modeNames[mode as keyof typeof modeNames] || mode;
  }

  /**
   * 从表格中选择接口 - 使用键盘导航
   */
  private async selectInterfacesFromTable(message: string): Promise<number[]> {
    return await this.selectWithTableKeyboardNavigation(message);
  }

  /**
   * 表格键盘导航模式选择接口
   */
  private async selectWithTableKeyboardNavigation(message: string): Promise<number[]> {
    const selectedIndices = new Set<number>();
    let currentRow = 0;
    let isSelecting = true;

    // 显示接口统计信息
    console.log('\n📋 接口详情:');
    this.formatter.displayInterfaceStats(this.endpoints);

    console.log('\n🎯 表格键盘导航模式:');
    console.log('  ↑↓ 上下箭头键在表格行间移动');
    console.log('  空格键 切换当前行的选择状态');
    console.log('  回车键 确认选择并继续');
    console.log('  ESC键 取消操作');
    console.log('  a键 全选所有接口');
    console.log('  c键 清空所有选择');
    console.log('\n按任意键开始...');

    // 等待用户按键开始
    await this.waitForKeyPress();

    // 设置原始模式以捕获键盘事件
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    process.stdin.resume();
    emitKeypressEvents(process.stdin);

    return new Promise((resolve, reject) => {
      const cleanup = () => {
        if (process.stdin.isTTY) {
          process.stdin.setRawMode(false);
        }
        process.stdin.pause();
        process.stdin.removeAllListeners('keypress');
      };

      const updateDisplay = () => {
        // 清屏并重新显示
        console.clear();
        console.log('\n📋 接口详情:');
        this.formatter.displayInterfaceStats(this.endpoints);
        
        // 显示带高亮的表格
        const table = this.createHighlightedTable(selectedIndices, currentRow);
        console.log(table);
        
        console.log(`\n当前位置: 第 ${currentRow + 1} 行 | 已选择: ${selectedIndices.size} 个接口`);
        console.log('↑↓移动 | 空格选择 | 回车确认 | ESC取消 | a全选 | c清空');
      };

      // 初始显示
      updateDisplay();

      process.stdin.on('keypress', (str, key) => {
        if (!key) return;

        switch (key.name) {
          case 'up':
            if (currentRow > 0) {
              currentRow--;
              updateDisplay();
            }
            break;

          case 'down':
            if (currentRow < this.endpoints.length - 1) {
              currentRow++;
              updateDisplay();
            }
            break;

          case 'space':
            // 切换当前行的选择状态
            if (selectedIndices.has(currentRow)) {
              selectedIndices.delete(currentRow);
            } else {
              selectedIndices.add(currentRow);
            }
            updateDisplay();
            break;

          case 'return':
          case 'enter':
            // 确认选择
            cleanup();
            console.log(`\n✅ 已选择 ${selectedIndices.size} 个接口`);
            resolve(Array.from(selectedIndices));
            break;

          case 'escape':
            // 取消操作
            cleanup();
            console.log('\n❌ 操作已取消');
            resolve([]);
            break;

          case 'a':
            // 全选
            for (let i = 0; i < this.endpoints.length; i++) {
              selectedIndices.add(i);
            }
            updateDisplay();
            break;

          case 'c':
            // 清空选择
            selectedIndices.clear();
            updateDisplay();
            break;

          case 'c':
            if (key.ctrl) {
              // Ctrl+C 退出
              cleanup();
              console.log('\n❌ 操作已取消');
              resolve([]);
            }
            break;
        }
      });
    });
  }

  /**
   * 等待用户按键
   */
  private async waitForKeyPress(): Promise<void> {
    return new Promise((resolve) => {
      const onKeyPress = () => {
        process.stdin.removeListener('keypress', onKeyPress);
        resolve();
      };
      
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
      }
      process.stdin.resume();
      emitKeypressEvents(process.stdin);
      process.stdin.on('keypress', onKeyPress);
    });
  }

  /**
   * 创建带高亮显示的表格
   */
  private createHighlightedTable(selectedIndices: Set<number>, currentRow: number): string {
    const Table = require('cli-table3');
    
    const table = new Table({
      head: ['', '序号', '方法', '路径', '描述', '标签', '状态'],
      colWidths: [3, 6, 12, 30, 40, 20, 8],
      style: {
        head: ['cyan'],
        border: ['lightgreen']
      }
    });

    this.endpoints.forEach((endpoint, index) => {
      const isSelected = selectedIndices.has(index);
      const isCurrent = index === currentRow;
      const selectStatus = isSelected ? '✓' : '✗';
      const description = endpoint.summary || endpoint.description || 'No description';
      const tags = endpoint.tags?.join(', ') || '-';
      const deprecated = endpoint.deprecated ? '⚠️' : '✅';
      
      // 当前行高亮显示
      const rowData = [
        isCurrent ? '►' : ' ',
        (index + 1).toString(),
        this.getMethodBadge(endpoint.method),
        endpoint.path,
        this.truncateText(description, 35),
        this.truncateText(tags, 15),
        selectStatus
      ];
      
      if (isCurrent) {
        // 高亮当前行 - 使用淡红色字体
        table.push(rowData.map(cell => `\x1b[91m${cell}\x1b[0m`));
      } else if (isSelected) {
        // 选中的行用绿色背景
        table.push(rowData.map(cell => `\x1b[42m\x1b[30m${cell}\x1b[0m`));
      } else {
        table.push(rowData);
      }
    });

    return table.toString();
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
   * 截断文本到指定长度
   */
  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength - 3) + '...';
  }

  /**
   * 处理页面索引选择
   */
  private processPageIndexSelection(
    command: string,
    pageSelectedIndices: Set<number>,
    allSelectedIndices: Set<number>,
    start: number,
    pageSize: number
  ): void {
    try {
      const parts = command.split(',');
      
      for (const part of parts) {
        const trimmed = part.trim();
        
        if (trimmed.includes('-')) {
          // 处理范围选择 (如: 1-5)
          const [startStr, endStr] = trimmed.split('-');
          const rangeStart = parseInt(startStr) - 1; // 转换为0基索引
          const rangeEnd = parseInt(endStr) - 1;
          
          if (rangeStart >= 0 && rangeEnd < pageSize && rangeStart <= rangeEnd) {
            for (let i = rangeStart; i <= rangeEnd; i++) {
              const globalIndex = start + i;
              if (allSelectedIndices.has(globalIndex)) {
                allSelectedIndices.delete(globalIndex);
              } else {
                allSelectedIndices.add(globalIndex);
              }
            }
          }
        } else {
          // 处理单个索引
          const index = parseInt(trimmed) - 1; // 转换为0基索引
          if (index >= 0 && index < pageSize) {
            const globalIndex = start + index;
            if (allSelectedIndices.has(globalIndex)) {
              allSelectedIndices.delete(globalIndex);
            } else {
              allSelectedIndices.add(globalIndex);
            }
          }
        }
      }
    } catch (error) {
      console.log('⚠️  无效的索引格式');
    }
  }

  /**
   * 检查路径是否匹配模式
   */
  private matchesPattern(path: string, pattern: string): boolean {
    const regexPattern = pattern
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\\\*/g, '.*');
    
    const regex = new RegExp(`^${regexPattern}$`, 'i');
    return regex.test(path);
  }
}