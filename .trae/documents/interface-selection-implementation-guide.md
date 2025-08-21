# OpenAPI 接口选择功能实现指南

## 1. 实现概述

本文档提供了在 `mcp-swagger-server` 项目中实现接口选择功能的详细技术指南，包括具体的代码实现、文件结构和集成方案。

## 2. 文件结构规划

```
packages/mcp-swagger-server/src/
├── interactive-cli/
│   ├── components/
│   │   ├── interface-selector.ts          # 新增：接口选择器
│   │   ├── interface-display-formatter.ts # 新增：接口显示格式化
│   │   └── selection-converter.ts         # 新增：选择结果转换器
│   ├── wizards/
│   │   └── openapi-wizard.ts             # 修改：集成接口选择步骤
│   └── types/
│       └── index.ts                      # 修改：添加新的类型定义
```

## 3. 核心组件实现

### 3.1 接口选择器 (InterfaceSelector)

```typescript
// src/interactive-cli/components/interface-selector.ts
import inquirer from 'inquirer';
import { OpenAPISpec, OperationObject } from '@mcp-swagger/parser';
import { EndpointExtractor, ApiEndpoint } from '@mcp-swagger/parser';
import { OperationFilter } from '../types';
import { InterfaceDisplayFormatter } from './interface-display-formatter';
import { SelectionConverter } from './selection-converter';

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
    private options: InterfaceSelectionOptions = {}
  ) {
    const extractor = new EndpointExtractor(spec);
    this.endpoints = extractor.extractEndpoints();
    this.formatter = new InterfaceDisplayFormatter(this.options);
    this.converter = new SelectionConverter();
  }

  /**
   * 启动接口选择流程
   */
  async selectInterfaces(): Promise<InterfaceSelectionResult> {
    console.log(`\n📋 发现 ${this.endpoints.length} 个 API 接口\n`);

    // 1. 选择选择模式
    const selectionMode = await this.chooseSelectionMode();
    
    // 2. 根据模式执行选择
    let operationFilter: OperationFilter;
    let selectedCount: number;

    switch (selectionMode) {
      case 'include':
        const includeResult = await this.selectByInclusion();
        operationFilter = includeResult.filter;
        selectedCount = includeResult.count;
        break;
        
      case 'exclude':
        const excludeResult = await this.selectByExclusion();
        operationFilter = excludeResult.filter;
        selectedCount = this.endpoints.length - excludeResult.count;
        break;
        
      case 'tags':
        const tagsResult = await this.selectByTags();
        operationFilter = tagsResult.filter;
        selectedCount = tagsResult.count;
        break;
        
      case 'patterns':
        const patternsResult = await this.selectByPatterns();
        operationFilter = patternsResult.filter;
        selectedCount = patternsResult.count;
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
      selectionMode
    };
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
  private async selectByInclusion(): Promise<{ filter: OperationFilter; count: number }> {
    const choices = this.formatter.formatForCheckboxSelection(this.endpoints);
    
    if (this.options.enablePagination && choices.length > (this.options.pageSize || 20)) {
      return await this.selectWithPagination(choices, 'include');
    }

    const { selected } = await inquirer.prompt([{
      type: 'checkbox',
      name: 'selected',
      message: '选择要包含的接口 (使用空格键选择，回车键确认):',
      choices,
      pageSize: this.options.pageSize || 15,
      validate: (input: string[]) => {
        if (input.length === 0) {
          return '请至少选择一个接口';
        }
        return true;
      }
    }]);

    const filter = this.converter.convertIncludeSelection(selected, this.endpoints);
    return { filter, count: selected.length };
  }

  /**
   * 排除模式选择
   */
  private async selectByExclusion(): Promise<{ filter: OperationFilter; count: number }> {
    const choices = this.formatter.formatForCheckboxSelection(this.endpoints);
    
    const { selected } = await inquirer.prompt([{
      type: 'checkbox',
      name: 'selected',
      message: '选择要排除的接口 (使用空格键选择，回车键确认):',
      choices,
      pageSize: this.options.pageSize || 15
    }]);

    const filter = this.converter.convertExcludeSelection(selected, this.endpoints);
    return { filter, count: selected.length };
  }

  /**
   * 按标签选择
   */
  private async selectByTags(): Promise<{ filter: OperationFilter; count: number }> {
    // 提取所有标签
    const allTags = new Set<string>();
    this.endpoints.forEach(endpoint => {
      endpoint.tags?.forEach(tag => allTags.add(tag));
    });

    if (allTags.size === 0) {
      console.log('⚠️  未发现任何标签，将使用包含模式');
      return await this.selectByInclusion();
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
    
    return { filter, count };
  }

  /**
   * 按路径模式选择
   */
  private async selectByPatterns(): Promise<{ filter: OperationFilter; count: number }> {
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
      patternList.some(pattern => this.matchesPattern(endpoint.path, pattern))
    ).length;

    console.log(`\n✅ 匹配到 ${count} 个接口`);
    return { filter, count };
  }

  /**
   * 分页选择（用于大量接口的情况）
   */
  private async selectWithPagination(
    choices: any[], 
    mode: 'include' | 'exclude'
  ): Promise<{ filter: OperationFilter; count: number }> {
    const pageSize = this.options.pageSize || 20;
    const totalPages = Math.ceil(choices.length / pageSize);
    let allSelected: string[] = [];

    for (let page = 0; page < totalPages; page++) {
      const start = page * pageSize;
      const end = Math.min(start + pageSize, choices.length);
      const pageChoices = choices.slice(start, end);

      console.log(`\n📄 第 ${page + 1}/${totalPages} 页 (${start + 1}-${end}/${choices.length})`);

      const { selected, action } = await inquirer.prompt([
        {
          type: 'checkbox',
          name: 'selected',
          message: `选择接口 (已选择 ${allSelected.length} 个):`,
          choices: pageChoices
        },
        {
          type: 'list',
          name: 'action',
          message: '选择操作:',
          choices: [
            { name: '继续下一页', value: 'next' },
            { name: '完成选择', value: 'finish' },
            { name: '取消选择', value: 'cancel' }
          ]
        }
      ]);

      allSelected.push(...selected);

      if (action === 'finish' || action === 'cancel') {
        if (action === 'cancel') {
          allSelected = [];
        }
        break;
      }
    }

    const filter = mode === 'include' 
      ? this.converter.convertIncludeSelection(allSelected, this.endpoints)
      : this.converter.convertExcludeSelection(allSelected, this.endpoints);
    
    return { filter, count: allSelected.length };
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
```

### 3.2 接口显示格式化器 (InterfaceDisplayFormatter)

```typescript
// src/interactive-cli/components/interface-display-formatter.ts
import { ApiEndpoint } from '@mcp-swagger/parser';
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
   * 格式化接口列表用于复选框选择
   */
  formatForCheckboxSelection(endpoints: ApiEndpoint[]): FormattedChoice[] {
    let filteredEndpoints = endpoints;

    // 过滤废弃的接口（如果配置不显示）
    if (!this.options.showDeprecated) {
      filteredEndpoints = endpoints.filter(e => !e.deprecated);
    }

    return filteredEndpoints.map(endpoint => {
      const methodColor = this.getMethodColor(endpoint.method);
      const deprecatedMark = endpoint.deprecated ? ' 🚫' : '';
      const tagsInfo = endpoint.tags?.length ? ` [${endpoint.tags.join(', ')}]` : '';
      
      const name = `${methodColor}${endpoint.method.toUpperCase()}\x1b[0m ${endpoint.path}${deprecatedMark}${tagsInfo}`;
      const description = endpoint.summary || endpoint.description;
      
      return {
        name: description ? `${name} - ${this.truncateText(description, 60)}` : name,
        value: `${endpoint.method}:${endpoint.path}`,
        short: `${endpoint.method.toUpperCase()} ${endpoint.path}`,
        disabled: endpoint.deprecated && !this.options.showDeprecated ? '已废弃' : false
      };
    });
  }

  /**
   * 格式化接口列表用于列表选择
   */
  formatForListSelection(endpoints: ApiEndpoint[]): FormattedChoice[] {
    return endpoints.map(endpoint => {
      const methodBadge = this.getMethodBadge(endpoint.method);
      const deprecatedMark = endpoint.deprecated ? ' (已废弃)' : '';
      
      return {
        name: `${methodBadge} ${endpoint.path}${deprecatedMark}`,
        value: `${endpoint.method}:${endpoint.path}`,
        short: `${endpoint.method.toUpperCase()} ${endpoint.path}`
      };
    });
  }

  /**
   * 按标签分组格式化
   */
  formatGroupedByTags(endpoints: ApiEndpoint[]): { [tag: string]: FormattedChoice[] } {
    const grouped: { [tag: string]: FormattedChoice[] } = {};
    const untagged: ApiEndpoint[] = [];

    endpoints.forEach(endpoint => {
      if (endpoint.tags && endpoint.tags.length > 0) {
        endpoint.tags.forEach(tag => {
          if (!grouped[tag]) {
            grouped[tag] = [];
          }
          grouped[tag].push(this.formatSingleEndpoint(endpoint));
        });
      } else {
        untagged.push(endpoint);
      }
    });

    if (untagged.length > 0) {
      grouped['未分类'] = untagged.map(e => this.formatSingleEndpoint(e));
    }

    return grouped;
  }

  /**
   * 格式化单个接口
   */
  private formatSingleEndpoint(endpoint: ApiEndpoint): FormattedChoice {
    const methodColor = this.getMethodColor(endpoint.method);
    const deprecatedMark = endpoint.deprecated ? ' 🚫' : '';
    
    return {
      name: `${methodColor}${endpoint.method.toUpperCase()}\x1b[0m ${endpoint.path}${deprecatedMark}`,
      value: `${endpoint.method}:${endpoint.path}`,
      short: `${endpoint.method.toUpperCase()} ${endpoint.path}`
    };
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
   * 截断文本
   */
  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength - 3) + '...';
  }
}
```

### 3.3 选择结果转换器 (SelectionConverter)

```typescript
// src/interactive-cli/components/selection-converter.ts
import { OperationFilter } from '../types';
import { ApiEndpoint } from '@mcp-swagger/parser';

/**
 * 选择结果转换器 - 将用户选择转换为 OperationFilter
 */
export class SelectionConverter {
  /**
   * 转换包含选择为操作过滤器
   */
  convertIncludeSelection(selected: string[], endpoints: ApiEndpoint[]): OperationFilter {
    const selectedEndpoints = this.parseSelectedItems(selected, endpoints);
    
    return {
      methods: {
        include: [...new Set(selectedEndpoints.map(e => e.method.toUpperCase()))]
      },
      paths: {
        include: selectedEndpoints.map(e => e.path)
      },
      operationIds: {
        include: selectedEndpoints
          .map(e => e.operationId)
          .filter(Boolean) as string[]
      },
      customFilter: (operation, method, path) => {
        return selectedEndpoints.some(e => 
          e.method.toUpperCase() === method.toUpperCase() && e.path === path
        );
      }
    };
  }

  /**
   * 转换排除选择为操作过滤器
   */
  convertExcludeSelection(selected: string[], endpoints: ApiEndpoint[]): OperationFilter {
    const excludedEndpoints = this.parseSelectedItems(selected, endpoints);
    
    return {
      customFilter: (operation, method, path) => {
        return !excludedEndpoints.some(e => 
          e.method.toUpperCase() === method.toUpperCase() && e.path === path
        );
      }
    };
  }

  /**
   * 转换标签选择为操作过滤器
   */
  convertTagsSelection(selectedTags: string[]): OperationFilter {
    return {
      customFilter: (operation) => {
        if (!operation.tags || operation.tags.length === 0) {
          return false;
        }
        return operation.tags.some(tag => selectedTags.includes(tag));
      }
    };
  }

  /**
   * 转换路径模式选择为操作过滤器
   */
  convertPatternsSelection(patterns: string[]): OperationFilter {
    return {
      paths: {
        include: patterns
      }
    };
  }

  /**
   * 解析选择的项目
   */
  private parseSelectedItems(selected: string[], endpoints: ApiEndpoint[]): ApiEndpoint[] {
    return selected.map(item => {
      const [method, path] = item.split(':');
      const endpoint = endpoints.find(e => 
        e.method.toLowerCase() === method.toLowerCase() && e.path === path
      );
      if (!endpoint) {
        throw new Error(`Endpoint not found: ${method} ${path}`);
      }
      return endpoint;
    });
  }
}
```

## 4. 集成到现有向导

### 4.1 修改 OpenAPIWizard

```typescript
// src/interactive-cli/wizards/openapi-wizard.ts (修改部分)
import { InterfaceSelector } from '../components/interface-selector';

// 在 getOpenAPIConfig 方法中添加接口选择步骤
private async getOpenAPIConfig(existingUrl?: string): Promise<Partial<SessionConfig> | null> {
  // ... 现有的 URL 选择逻辑 ...

  // 验证 OpenAPI 文档
  const validation = await this.validateOpenAPIDocument(openApiUrl);
  if (!validation.valid) {
    console.error('❌ OpenAPI 文档验证失败:');
    validation.errors?.forEach(error => console.error(`  - ${error}`));
    return null;
  }

  console.log('✅ OpenAPI 文档验证成功!');
  if (validation.title) console.log(`  标题: ${validation.title}`);
  if (validation.version) console.log(`  版本: ${validation.version}`);
  if (validation.operationCount) console.log(`  操作数量: ${validation.operationCount}`);

  // 新增：接口选择步骤
  let operationFilter: OperationFilter | undefined;
  
  if (validation.operationCount && validation.operationCount > 1) {
    const shouldSelectInterfaces = await this.inquirer.prompt([{
      type: 'confirm',
      name: 'select',
      message: '是否要选择特定的接口进行转换？（选择 No 将转换所有接口）',
      default: false
    }]);

    if (shouldSelectInterfaces.select) {
      try {
        // 重新解析 OpenAPI 文档以获取完整的规范
        const spec = await this.parseOpenAPISpec(openApiUrl);
        const selector = new InterfaceSelector(spec, {
          enablePagination: validation.operationCount > 20,
          pageSize: 15,
          showDeprecated: true
        });
        
        const selectionResult = await selector.selectInterfaces();
        operationFilter = selectionResult.operationFilter;
        
        console.log(`\n✅ 接口选择完成，将转换 ${selectionResult.selectedCount} 个接口`);
      } catch (error) {
        console.error('❌ 接口选择失败:', error);
        console.log('将继续转换所有接口...');
      }
    }
  }

  return { openApiUrl, operationFilter };
}

/**
 * 解析 OpenAPI 规范（新增方法）
 */
private async parseOpenAPISpec(url: string): Promise<OpenAPISpec> {
  // 这里需要使用 mcp-swagger-parser 来解析完整的规范
  const { OpenAPIParser } = await import('@mcp-swagger/parser');
  const parser = new OpenAPIParser();
  const result = await parser.parse(url);
  return result.spec;
}
```

### 4.2 扩展类型定义

```typescript
// src/interactive-cli/types/index.ts (添加部分)
export interface SessionConfig {
  id: string;
  name: string;
  description?: string;
  openApiUrl: string;
  transport: TransportType;
  port?: number;
  host?: string;
  auth?: AuthConfig;
  customHeaders?: Record<string, string>;
  operationFilter?: OperationFilter;  // 现有
  
  // 新增：接口选择相关配置
  interfaceSelection?: {
    enabled: boolean;
    mode: 'include' | 'exclude' | 'tags' | 'patterns';
    selectedItems: string[];
    timestamp: string;
    totalCount: number;
    selectedCount: number;
  };
  
  createdAt: string;
  lastUsed: string;
}

// 新增：接口选择相关类型
export interface InterfaceSelectionConfig {
  enabled: boolean;
  mode: 'include' | 'exclude' | 'tags' | 'patterns';
  selectedItems: string[];
  patterns?: string[];
  tags?: string[];
}
```

## 5. 用户体验优化

### 5.1 搜索功能实现

```typescript
// 在 InterfaceSelector 中添加搜索功能
private async searchInterfaces(endpoints: ApiEndpoint[]): Promise<ApiEndpoint[]> {
  const { searchTerm } = await inquirer.prompt([{
    type: 'input',
    name: 'searchTerm',
    message: '输入搜索关键词 (路径、方法、描述):'
  }]);

  if (!searchTerm.trim()) {
    return endpoints;
  }

  const term = searchTerm.toLowerCase();
  return endpoints.filter(endpoint => 
    endpoint.path.toLowerCase().includes(term) ||
    endpoint.method.toLowerCase().includes(term) ||
    endpoint.summary?.toLowerCase().includes(term) ||
    endpoint.description?.toLowerCase().includes(term) ||
    endpoint.tags?.some(tag => tag.toLowerCase().includes(term))
  );
}
```

### 5.2 预览功能实现

```typescript
// 添加选择预览功能
private displaySelectionPreview(selected: string[], endpoints: ApiEndpoint[]): void {
  console.log('\n📋 选择预览:');
  
  const selectedEndpoints = this.parseSelectedItems(selected, endpoints);
  const groupedByMethod = selectedEndpoints.reduce((acc, endpoint) => {
    const method = endpoint.method.toUpperCase();
    if (!acc[method]) acc[method] = [];
    acc[method].push(endpoint.path);
    return acc;
  }, {} as Record<string, string[]>);

  Object.entries(groupedByMethod).forEach(([method, paths]) => {
    console.log(`  ${method}: ${paths.length} 个接口`);
    paths.slice(0, 3).forEach(path => console.log(`    - ${path}`));
    if (paths.length > 3) {
      console.log(`    ... 还有 ${paths.length - 3} 个接口`);
    }
  });
}
```

## 6. 测试策略

### 6.1 单元测试

```typescript
// tests/components/interface-selector.test.ts
import { InterfaceSelector } from '../../src/interactive-cli/components/interface-selector';
import { mockOpenAPISpec, mockEndpoints } from '../fixtures/openapi-fixtures';

describe('InterfaceSelector', () => {
  let selector: InterfaceSelector;

  beforeEach(() => {
    selector = new InterfaceSelector(mockOpenAPISpec);
  });

  describe('selectInterfaces', () => {
    it('should return operation filter for include mode', async () => {
      // Mock user interactions
      // Test implementation
    });

    it('should handle large number of interfaces with pagination', async () => {
      // Test pagination logic
    });

    it('should support tag-based selection', async () => {
      // Test tag selection
    });
  });
});
```

### 6.2 集成测试

```typescript
// tests/integration/openapi-wizard-integration.test.ts
import { OpenAPIWizard } from '../../src/interactive-cli/wizards/openapi-wizard';

describe('OpenAPIWizard Integration', () => {
  it('should integrate interface selection into wizard flow', async () => {
    // Test complete wizard flow with interface selection
  });

  it('should save interface selection to session config', async () => {
    // Test configuration persistence
  });
});
```

## 7. 部署和发布

### 7.1 版本控制

- 功能开发在 `feature/interface-selection` 分支进行
- 完成后合并到 `develop` 分支进行集成测试
- 测试通过后合并到 `main` 分支发布

### 7.2 向后兼容性

- 新功能作为可选步骤，不影响现有配置流程
- 现有的 `SessionConfig` 保持兼容
- 新增的配置字段都是可选的

### 7.3 文档更新

- 更新 README.md 中的功能说明
- 添加接口选择功能的使用示例
- 更新 CLI 帮助文档

## 8. 总结

本实现方案提供了完整的接口选择功能，具有以下特点：

1. **模块化设计**：功能拆分为独立的组件，便于维护和测试
2. **用户友好**：提供多种选择模式和直观的界面
3. **高性能**：支持分页和搜索，处理大量接口
4. **向后兼容**：不破坏现有功能
5. **可扩展**：易于添加新的选择模式和功能

该实现方案可以显著提升用户体验，让用户能够精确控制要转换的 API 接口。