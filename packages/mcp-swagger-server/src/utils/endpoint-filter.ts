import { ApiEndpoint } from 'mcp-swagger-parser';
import { OperationFilter } from 'mcp-swagger-parser/dist/transformer/types';
import { OperationObject } from 'mcp-swagger-parser/dist/types/openapi';

/**
 * 接口过滤器工具类
 * 复用transformToMCPTools中的过滤逻辑，确保表格显示与最终转换的一致性
 */
export class EndpointFilter {
  /**
   * 检查操作是否应该被包含
   */
  static shouldIncludeEndpoint(
    endpoint: ApiEndpoint,
    options: {
      includeDeprecated?: boolean;
      includeTags?: string[];
      excludeTags?: string[];
      operationFilter?: OperationFilter;
    } = {}
  ): boolean {
    const operation: OperationObject = {
      operationId: endpoint.operationId,
      summary: endpoint.summary,
      description: endpoint.description,
      tags: endpoint.tags,
      deprecated: endpoint.deprecated,
      parameters: endpoint.parameters,
      requestBody: endpoint.requestBody,
      responses: endpoint.responses,
      security: endpoint.security
    };

    // Skip deprecated operations if not included
    if (operation.deprecated && !options.includeDeprecated) {
      return false;
    }

    // Include/exclude by tags
    if (operation.tags) {
      // If includeTags is specified, only include operations with those tags
      if (options.includeTags && options.includeTags.length > 0) {
        const hasIncludedTag = operation.tags.some(tag => options.includeTags!.includes(tag));
        if (!hasIncludedTag) {
          return false;
        }
      }

      // Exclude operations with excluded tags
      if (options.excludeTags && options.excludeTags.length > 0) {
        const hasExcludedTag = operation.tags.some(tag => options.excludeTags!.includes(tag));
        if (hasExcludedTag) {
          return false;
        }
      }
    }

    // Apply operation filter if configured
    if (options.operationFilter) {
      return EndpointFilter.applyOperationFilter(operation, endpoint.method, endpoint.path, options.operationFilter);
    }

    return true;
  }

  /**
   * 应用操作过滤器
   */
  private static applyOperationFilter(
    operation: OperationObject,
    method: string,
    path: string,
    filter: OperationFilter
  ): boolean {
    // HTTP方法过滤
    if (filter.methods) {
      const methodUpper = method.toUpperCase();
      if (filter.methods.include && filter.methods.include.length > 0) {
        if (!filter.methods.include.map((m: string) => m.toUpperCase()).includes(methodUpper)) {
          return false;
        }
      }
      if (filter.methods.exclude && filter.methods.exclude.length > 0) {
        if (filter.methods.exclude.map((m: string) => m.toUpperCase()).includes(methodUpper)) {
          return false;
        }
      }
    }

    // 路径过滤
    if (filter.paths) {
      if (filter.paths.include && filter.paths.include.length > 0) {
        const matchesInclude = filter.paths.include.some((pattern: string) => 
          EndpointFilter.matchesPattern(path, pattern)
        );
        if (!matchesInclude) {
          return false;
        }
      }
      if (filter.paths.exclude && filter.paths.exclude.length > 0) {
        const matchesExclude = filter.paths.exclude.some((pattern: string) => 
          EndpointFilter.matchesPattern(path, pattern)
        );
        if (matchesExclude) {
          return false;
        }
      }
    }

    // 操作ID过滤
    if (filter.operationIds && operation.operationId) {
      if (filter.operationIds.include && filter.operationIds.include.length > 0) {
        const matchesInclude = filter.operationIds.include.some((pattern: string) => 
          EndpointFilter.matchesPattern(operation.operationId!, pattern)
        );
        if (!matchesInclude) {
          return false;
        }
      }
      if (filter.operationIds.exclude && filter.operationIds.exclude.length > 0) {
        const matchesExclude = filter.operationIds.exclude.some((pattern: string) => 
          EndpointFilter.matchesPattern(operation.operationId!, pattern)
        );
        if (matchesExclude) {
          return false;
        }
      }
    }

    // 响应状态码过滤
    if (filter.statusCodes && operation.responses) {
      const responseCodes = Object.keys(operation.responses)
        .map(code => parseInt(code))
        .filter(code => !isNaN(code));
      
      if (filter.statusCodes.include && filter.statusCodes.include.length > 0) {
        const hasIncludedStatus = responseCodes.some(code => 
          filter.statusCodes!.include!.includes(code)
        );
        if (!hasIncludedStatus) {
          return false;
        }
      }
      if (filter.statusCodes.exclude && filter.statusCodes.exclude.length > 0) {
        const hasExcludedStatus = responseCodes.some(code => 
          filter.statusCodes!.exclude!.includes(code)
        );
        if (hasExcludedStatus) {
          return false;
        }
      }
    }

    // 参数过滤
    if (filter.parameters && operation.parameters) {
      const paramNames = operation.parameters
        .filter(param => !EndpointFilter.isReferenceObject(param))
        .map(param => (param as any).name);
      
      if (filter.parameters.required && filter.parameters.required.length > 0) {
        const hasRequiredParam = filter.parameters.required.some((paramName: string) => 
          paramNames.includes(paramName)
        );
        if (!hasRequiredParam) {
          return false;
        }
      }
      if (filter.parameters.forbidden && filter.parameters.forbidden.length > 0) {
        const hasForbiddenParam = filter.parameters.forbidden.some((paramName: string) => 
          paramNames.includes(paramName)
        );
        if (hasForbiddenParam) {
          return false;
        }
      }
    }

    // 自定义过滤函数
    if (filter.customFilter) {
      return filter.customFilter(operation, method, path);
    }

    return true;
  }

  /**
   * 检查字符串是否匹配模式（支持通配符）
   */
  private static matchesPattern(str: string, pattern: string): boolean {
    // Convert wildcard pattern to regex
    const regexPattern = pattern
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // Escape special regex chars
      .replace(/\\\*/g, '.*'); // Convert * to .*
    
    const regex = new RegExp(`^${regexPattern}$`, 'i');
    return regex.test(str);
  }

  /**
   * 检查对象是否为引用对象
   */
  private static isReferenceObject(obj: any): obj is { $ref: string } {
    return obj && typeof obj === 'object' && '$ref' in obj;
  }

  /**
   * 过滤接口列表
   */
  static filterEndpoints(
    endpoints: ApiEndpoint[],
    options: {
      includeDeprecated?: boolean;
      includeTags?: string[];
      excludeTags?: string[];
      operationFilter?: OperationFilter;
    } = {}
  ): ApiEndpoint[] {
    return endpoints.filter(endpoint => 
      EndpointFilter.shouldIncludeEndpoint(endpoint, options)
    );
  }
}