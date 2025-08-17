import type { OperationFilter } from 'mcp-swagger-parser';

/**
 * 验证操作过滤配置的有效性
 * @param operationFilter 操作过滤配置
 * @returns 验证结果
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * 验证操作过滤配置
 */
export function validateOperationFilter(operationFilter: any): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: []
  };

  if (!operationFilter || typeof operationFilter !== 'object') {
    result.errors.push('操作过滤配置必须是一个对象');
    result.valid = false;
    return result;
  }

  // 验证 methods 字段
  if (operationFilter.methods !== undefined) {
    if (typeof operationFilter.methods !== 'object') {
      result.errors.push('methods 字段必须是一个对象');
      result.valid = false;
    } else {
      const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS', 'TRACE'];
      
      if (operationFilter.methods.include && !Array.isArray(operationFilter.methods.include)) {
        result.errors.push('methods.include 必须是字符串数组');
        result.valid = false;
      } else if (operationFilter.methods.include) {
        const invalidMethods = operationFilter.methods.include.filter((method: string) => 
          !validMethods.includes(method.toUpperCase())
        );
        if (invalidMethods.length > 0) {
          result.warnings.push(`无效的 HTTP 方法 (include): ${invalidMethods.join(', ')}`);
        }
      }
      
      if (operationFilter.methods.exclude && !Array.isArray(operationFilter.methods.exclude)) {
        result.errors.push('methods.exclude 必须是字符串数组');
        result.valid = false;
      } else if (operationFilter.methods.exclude) {
        const invalidMethods = operationFilter.methods.exclude.filter((method: string) => 
          !validMethods.includes(method.toUpperCase())
        );
        if (invalidMethods.length > 0) {
          result.warnings.push(`无效的 HTTP 方法 (exclude): ${invalidMethods.join(', ')}`);
        }
      }
    }
  }

  // 验证 paths 字段
  if (operationFilter.paths !== undefined) {
    if (typeof operationFilter.paths !== 'object') {
      result.errors.push('paths 字段必须是一个对象');
      result.valid = false;
    } else {
      if (operationFilter.paths.include && !Array.isArray(operationFilter.paths.include)) {
        result.errors.push('paths.include 必须是字符串数组');
        result.valid = false;
      }
      if (operationFilter.paths.exclude && !Array.isArray(operationFilter.paths.exclude)) {
        result.errors.push('paths.exclude 必须是字符串数组');
        result.valid = false;
      }
    }
  }

  // 验证 operationIds 字段
  if (operationFilter.operationIds !== undefined) {
    if (typeof operationFilter.operationIds !== 'object') {
      result.errors.push('operationIds 字段必须是一个对象');
      result.valid = false;
    } else {
      if (operationFilter.operationIds.include && !Array.isArray(operationFilter.operationIds.include)) {
        result.errors.push('operationIds.include 必须是字符串数组');
        result.valid = false;
      }
      if (operationFilter.operationIds.exclude && !Array.isArray(operationFilter.operationIds.exclude)) {
        result.errors.push('operationIds.exclude 必须是字符串数组');
        result.valid = false;
      }
    }
  }

  // 验证 statusCodes 字段
  if (operationFilter.statusCodes !== undefined) {
    if (typeof operationFilter.statusCodes !== 'object') {
      result.errors.push('statusCodes 字段必须是一个对象');
      result.valid = false;
    } else {
      if (operationFilter.statusCodes.include && !Array.isArray(operationFilter.statusCodes.include)) {
        result.errors.push('statusCodes.include 必须是数字数组');
        result.valid = false;
      }
      if (operationFilter.statusCodes.exclude && !Array.isArray(operationFilter.statusCodes.exclude)) {
        result.errors.push('statusCodes.exclude 必须是数字数组');
        result.valid = false;
      }
    }
  }

  // 验证 parameters 字段
  if (operationFilter.parameters !== undefined) {
    if (typeof operationFilter.parameters !== 'object') {
      result.errors.push('parameters 字段必须是一个对象');
      result.valid = false;
    } else {
      if (operationFilter.parameters.required && !Array.isArray(operationFilter.parameters.required)) {
        result.errors.push('parameters.required 必须是字符串数组');
        result.valid = false;
      }
      if (operationFilter.parameters.forbidden && !Array.isArray(operationFilter.parameters.forbidden)) {
        result.errors.push('parameters.forbidden 必须是字符串数组');
        result.valid = false;
      }
    }
  }

  // 验证 customFilter 字段
  if (operationFilter.customFilter !== undefined && typeof operationFilter.customFilter !== 'function') {
    result.errors.push('customFilter 必须是一个函数');
    result.valid = false;
  }

  return result;
}

/**
 * 规范化操作过滤配置
 * @param operationFilter 原始操作过滤配置
 * @returns 规范化后的配置
 */
export function normalizeOperationFilter(operationFilter: any): OperationFilter {
  if (!operationFilter || typeof operationFilter !== 'object') {
    return {};
  }

  const normalized: OperationFilter = {};

  // 规范化 methods
  if (operationFilter.methods && typeof operationFilter.methods === 'object') {
    normalized.methods = {};
    if (operationFilter.methods.include && Array.isArray(operationFilter.methods.include)) {
      normalized.methods.include = operationFilter.methods.include
        .map((method: any) => typeof method === 'string' ? method.toUpperCase() : '')
        .filter((method: string) => method !== '');
    }
    if (operationFilter.methods.exclude && Array.isArray(operationFilter.methods.exclude)) {
      normalized.methods.exclude = operationFilter.methods.exclude
        .map((method: any) => typeof method === 'string' ? method.toUpperCase() : '')
        .filter((method: string) => method !== '');
    }
  }

  // 规范化 paths
  if (operationFilter.paths && typeof operationFilter.paths === 'object') {
    normalized.paths = {};
    if (operationFilter.paths.include && Array.isArray(operationFilter.paths.include)) {
      normalized.paths.include = operationFilter.paths.include
        .map((path: any) => typeof path === 'string' ? path.trim() : '')
        .filter((path: string) => path !== '');
    }
    if (operationFilter.paths.exclude && Array.isArray(operationFilter.paths.exclude)) {
      normalized.paths.exclude = operationFilter.paths.exclude
        .map((path: any) => typeof path === 'string' ? path.trim() : '')
        .filter((path: string) => path !== '');
    }
  }

  // 规范化 operationIds
  if (operationFilter.operationIds && typeof operationFilter.operationIds === 'object') {
    normalized.operationIds = {};
    if (operationFilter.operationIds.include && Array.isArray(operationFilter.operationIds.include)) {
      normalized.operationIds.include = operationFilter.operationIds.include
        .map((id: any) => typeof id === 'string' ? id.trim() : '')
        .filter((id: string) => id !== '');
    }
    if (operationFilter.operationIds.exclude && Array.isArray(operationFilter.operationIds.exclude)) {
      normalized.operationIds.exclude = operationFilter.operationIds.exclude
        .map((id: any) => typeof id === 'string' ? id.trim() : '')
        .filter((id: string) => id !== '');
    }
  }

  // 规范化 statusCodes
  if (operationFilter.statusCodes && typeof operationFilter.statusCodes === 'object') {
    normalized.statusCodes = {};
    if (operationFilter.statusCodes.include && Array.isArray(operationFilter.statusCodes.include)) {
      normalized.statusCodes.include = operationFilter.statusCodes.include
        .map((code: any) => {
          const num = Number(code);
          return Number.isInteger(num) && num >= 100 && num <= 599 ? num : null;
        })
        .filter((code: number | null) => code !== null) as number[];
    }
    if (operationFilter.statusCodes.exclude && Array.isArray(operationFilter.statusCodes.exclude)) {
      normalized.statusCodes.exclude = operationFilter.statusCodes.exclude
        .map((code: any) => {
          const num = Number(code);
          return Number.isInteger(num) && num >= 100 && num <= 599 ? num : null;
        })
        .filter((code: number | null) => code !== null) as number[];
    }
  }

  // 规范化 parameters
  if (operationFilter.parameters && typeof operationFilter.parameters === 'object') {
    normalized.parameters = {};
    if (operationFilter.parameters.required && Array.isArray(operationFilter.parameters.required)) {
      normalized.parameters.required = operationFilter.parameters.required
        .map((param: any) => typeof param === 'string' ? param.trim() : '')
        .filter((param: string) => param !== '');
    }
    if (operationFilter.parameters.forbidden && Array.isArray(operationFilter.parameters.forbidden)) {
      normalized.parameters.forbidden = operationFilter.parameters.forbidden
        .map((param: any) => typeof param === 'string' ? param.trim() : '')
        .filter((param: string) => param !== '');
    }
  }

  // 规范化 customFilter
  if (operationFilter.customFilter && typeof operationFilter.customFilter === 'function') {
    normalized.customFilter = operationFilter.customFilter;
  }

  return normalized;
}