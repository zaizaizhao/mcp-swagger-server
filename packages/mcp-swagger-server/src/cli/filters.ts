import chalk from 'chalk';
import type { OperationFilter } from 'mcp-swagger-parser';
import { validateOperationFilter, normalizeOperationFilter } from '../utils/validation';
import { ServerOptions, ConfigFile } from './types';

function deepMergeFilterField<T extends { include?: string[]; exclude?: string[] }>(
  base: T | undefined,
  override: T | undefined
): T | undefined {
  if (!override) return base;
  if (!base) return override;
  
  return {
    ...base,
    ...override,
    include: override.include || base.include,
    exclude: override.exclude || base.exclude,
  } as T;
}

function deepMergeParameterField(
  base: { required?: string[]; forbidden?: string[] } | undefined,
  override: { required?: string[]; forbidden?: string[] } | undefined
): { required?: string[]; forbidden?: string[] } | undefined {
  if (!override) return base;
  if (!base) return override;
  
  return {
    required: override.required || base.required,
    forbidden: override.forbidden || base.forbidden,
  };
}

function normalizeStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const normalized = value
    .map(item => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeNumberArray(value: unknown): number[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const normalized = value
    .map(item => Number(item))
    .filter(item => Number.isFinite(item));
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeIncludeExcludeStringField(
  value: unknown
): { include?: string[]; exclude?: string[] } | undefined {
  if (!value) return undefined;
  if (Array.isArray(value)) {
    const include = normalizeStringArray(value);
    return include ? { include } : undefined;
  }
  if (typeof value !== 'object') return undefined;
  const candidate = value as { include?: unknown; exclude?: unknown };
  const include = normalizeStringArray(candidate.include);
  const exclude = normalizeStringArray(candidate.exclude);
  if (!include && !exclude) return undefined;
  return { include, exclude };
}

function normalizeIncludeExcludeNumberField(
  value: unknown
): { include?: number[]; exclude?: number[] } | undefined {
  if (!value) return undefined;
  if (Array.isArray(value)) {
    const include = normalizeNumberArray(value);
    return include ? { include } : undefined;
  }
  if (typeof value !== 'object') return undefined;
  const candidate = value as { include?: unknown; exclude?: unknown };
  const include = normalizeNumberArray(candidate.include);
  const exclude = normalizeNumberArray(candidate.exclude);
  if (!include && !exclude) return undefined;
  return { include, exclude };
}

function normalizeParameterField(
  value: unknown
): { required?: string[]; forbidden?: string[] } | undefined {
  if (!value) return undefined;
  if (Array.isArray(value)) {
    const required = normalizeStringArray(value);
    return required ? { required } : undefined;
  }
  if (typeof value !== 'object') return undefined;
  const candidate = value as { required?: unknown; forbidden?: unknown };
  const required = normalizeStringArray(candidate.required);
  const forbidden = normalizeStringArray(candidate.forbidden);
  if (!required && !forbidden) return undefined;
  return { required, forbidden };
}

function normalizeConfigOperationFilter(
  configFilter?: ConfigFile['operationFilter']
): OperationFilter | undefined {
  if (!configFilter || typeof configFilter !== 'object') {
    return undefined;
  }

  const normalized: OperationFilter = {};

  const methods = normalizeIncludeExcludeStringField(configFilter.methods);
  if (methods) normalized.methods = methods;

  const paths = normalizeIncludeExcludeStringField(configFilter.paths);
  if (paths) normalized.paths = paths;

  const operationIds = normalizeIncludeExcludeStringField(configFilter.operationIds);
  if (operationIds) normalized.operationIds = operationIds;

  const statusCodes = normalizeIncludeExcludeNumberField(configFilter.statusCodes);
  if (statusCodes) normalized.statusCodes = statusCodes as OperationFilter['statusCodes'];

  const parameters = normalizeParameterField(configFilter.parameters);
  if (parameters) normalized.parameters = parameters;

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

export function parseOperationFilter(
  options: ServerOptions & { 
    'operation-filter-methods'?: string[], 
    'operation-filter-paths'?: string[], 
    'operation-filter-operation-ids'?: string[], 
    'operation-filter-status-codes'?: string[], 
    'operation-filter-parameters'?: string[] 
  },
  config?: ConfigFile
): OperationFilter | undefined {
  const filter: OperationFilter = {};
  let hasConfig = false;

  if (config?.operationFilter) {
    const normalizedConfigFilter = normalizeConfigOperationFilter(config.operationFilter);
    if (normalizedConfigFilter) {
      Object.assign(filter, normalizedConfigFilter);
      hasConfig = true;
    }
  }

  if (options['operation-filter-methods']) {
    const cliMethods = { include: options['operation-filter-methods'] };
    filter.methods = deepMergeFilterField(filter.methods, cliMethods);
    hasConfig = true;
  }

  if (options['operation-filter-paths']) {
    const cliPaths = { include: options['operation-filter-paths'] };
    filter.paths = deepMergeFilterField(filter.paths, cliPaths);
    hasConfig = true;
  }

  if (options['operation-filter-operation-ids']) {
    const cliOperationIds = { include: options['operation-filter-operation-ids'] };
    filter.operationIds = deepMergeFilterField(filter.operationIds, cliOperationIds);
    hasConfig = true;
  }

  if (options['operation-filter-status-codes']) {
    const parsedCodes = options['operation-filter-status-codes']
      .map(code => parseInt(code, 10))
      .filter(code => !isNaN(code));
    const cliStatusCodes = { include: parsedCodes };
    filter.statusCodes = deepMergeFilterField(filter.statusCodes as any, cliStatusCodes as any);
    hasConfig = true;
  }

  if (options['operation-filter-parameters']) {
    const cliParams = { required: options['operation-filter-parameters'] };
    filter.parameters = deepMergeParameterField(filter.parameters, cliParams);
    hasConfig = true;
  }

  if (!hasConfig) {
    return undefined;
  }

  const validationResult = validateOperationFilter(filter);
  
  if (!validationResult.valid) {
    console.error(chalk.red('❌ Operation filter configuration validation failed:'));
    validationResult.errors.forEach(error => {
      console.error(chalk.red(`   • ${error}`));
    });
    process.exit(1);
  }

  if (validationResult.warnings.length > 0) {
    console.warn(chalk.yellow('⚠️  Operation filter configuration warnings:'));
    validationResult.warnings.forEach(warning => {
      console.warn(chalk.yellow(`   • ${warning}`));
    });
  }

  const normalizedFilter = normalizeOperationFilter(filter);
  
  if (normalizedFilter && Object.keys(normalizedFilter).length > 0) {
    console.log(chalk.green('✅ Operation filter configuration loaded successfully'));
    
    if (normalizedFilter.methods) {
      const methods = [];
      if (normalizedFilter.methods.include) methods.push(`include: ${normalizedFilter.methods.include.join(', ')}`);
      if (normalizedFilter.methods.exclude) methods.push(`exclude: ${normalizedFilter.methods.exclude.join(', ')}`);
      if (methods.length > 0) {
        console.log(chalk.blue(`   Methods: ${methods.join('; ')}`));
      }
    }
    if (normalizedFilter.paths) {
      const paths = [];
      if (normalizedFilter.paths.include) paths.push(`include: ${normalizedFilter.paths.include.length} path(s)`);
      if (normalizedFilter.paths.exclude) paths.push(`exclude: ${normalizedFilter.paths.exclude.length} path(s)`);
      if (paths.length > 0) {
        console.log(chalk.blue(`   Paths: ${paths.join('; ')}`));
      }
    }
    if (normalizedFilter.operationIds) {
      const operationIds = [];
      if (normalizedFilter.operationIds.include) operationIds.push(`include: ${normalizedFilter.operationIds.include.length} ID(s)`);
      if (normalizedFilter.operationIds.exclude) operationIds.push(`exclude: ${normalizedFilter.operationIds.exclude.length} ID(s)`);
      if (operationIds.length > 0) {
        console.log(chalk.blue(`   Operation IDs: ${operationIds.join('; ')}`));
      }
    }
    if (normalizedFilter.statusCodes) {
      const statusCodes = [];
      if (normalizedFilter.statusCodes.include) statusCodes.push(`include: ${normalizedFilter.statusCodes.include.join(', ')}`);
      if (normalizedFilter.statusCodes.exclude) statusCodes.push(`exclude: ${normalizedFilter.statusCodes.exclude.join(', ')}`);
      if (statusCodes.length > 0) {
        console.log(chalk.blue(`   Status Codes: ${statusCodes.join('; ')}`));
      }
    }
    if (normalizedFilter.parameters) {
      const parameters = [];
      if (normalizedFilter.parameters.required) parameters.push(`required: ${normalizedFilter.parameters.required.length} parameter(s)`);
      if (normalizedFilter.parameters.forbidden) parameters.push(`forbidden: ${normalizedFilter.parameters.forbidden.length} parameter(s)`);
      if (parameters.length > 0) {
        console.log(chalk.blue(`   Parameters: ${parameters.join('; ')}`));
      }
    }
    if (normalizedFilter.customFilter) {
      console.log(chalk.blue('   Custom Filter: enabled'));
    }
  }

  return normalizedFilter;
}
