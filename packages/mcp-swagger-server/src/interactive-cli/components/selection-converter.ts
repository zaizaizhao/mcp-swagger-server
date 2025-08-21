import { OperationFilter } from '../types';
import { ApiEndpoint } from 'mcp-swagger-parser';

/**
 * 选择结果转换器 - 将用户选择转换为 OperationFilter
 */
export class SelectionConverter {
  /**
   * 转换包含选择为操作过滤器
   */
  convertIncludeSelection(selected: string[], endpoints: ApiEndpoint[]): OperationFilter {
    const selectedEndpoints = this.parseSelectedItems(selected, endpoints);
    
    // 调试输出：显示选择的接口信息
    console.log(`\n[DEBUG] 接口选择转换:`);
    console.log(`- 用户选择的接口数量: ${selected.length}`);
    console.log(`- 用户选择的接口列表: ${selected.join(', ')}`);
    console.log(`- 解析后的接口数量: ${selectedEndpoints.length}`);
    console.log(`- 解析后的接口详情:`);
    selectedEndpoints.forEach((endpoint, index) => {
      console.log(`  ${index + 1}. ${endpoint.method.toUpperCase()} ${endpoint.path} (${endpoint.operationId || 'no operationId'})`);
    });
    
    // 对于包含模式，只使用customFilter来精确匹配选择的接口
    // 避免与methods、paths、operationIds产生AND关系冲突
    return {
      customFilter: (operation, method, path) => {
        const isSelected = selectedEndpoints.some(e => 
          e.method.toUpperCase() === method.toUpperCase() && e.path === path
        );
        console.log(`[DEBUG] 检查接口 ${method.toUpperCase()} ${path}: ${isSelected ? '包含' : '排除'}`);
        return isSelected;
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
        return operation.tags.some((tag: string) => selectedTags.includes(tag));
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