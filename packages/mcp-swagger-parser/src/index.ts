/**
 * @fileoverview MCP Swagger Parser - OpenAPI/Swagger specification parser for Model Context Protocol
 * @version 1.0.0
 * @author MCP Swagger Team
 * @license MIT
 */

// Export types
export * from './types/index';

// Export core functionality
export * from './core/parser';
export * from './core/validator';
export * from './core/normalizer';
export * from './core/version-detector';
export * from './core/swagger2openapi-converter';

// Export parsers
export * from './parsers/base-parser';
export * from './parsers/url-parser';
export * from './parsers/file-parser';
export * from './parsers/text-parser';

// Export extractors
export * from './extractors/index';

// Export utilities
export * from './utils/index';

// Export errors
export * from './errors/index';

// Re-export commonly used functions for convenience
import { OpenAPIParser } from './core/parser';
import { transformToMCPTools, type TransformerOptions } from './transformer/index';
import type { OpenAPISpec, ParserConfig } from './types/index';

// Create convenience functions
export const parseFromFile = async (filePath: string, config?: ParserConfig) => {
  const parser = new OpenAPIParser(config);
  return parser.parseFromFile(filePath);
};

export const parseFromUrl = async (url: string, config?: ParserConfig) => {
  const parser = new OpenAPIParser(config);
  return parser.parseFromUrl(url);
};

export const parseFromString = async (content: string, config?: ParserConfig) => {
  const parser = new OpenAPIParser(config);
  return parser.parseFromString(content);
};

// Export transformer functions
export { transformToMCPTools, OpenAPIToMCPTransformer } from './transformer/index';
export type { MCPTool, MCPToolResponse, TransformerOptions, CustomHeaders, RequestContext } from './transformer/types';

// Export auth types
export type { AuthConfig, AuthManager, BearerConfig, ApiKeyConfig, BasicConfig, OAuth2Config, CustomConfig } from './auth/types';
export { BearerAuthManager } from './auth/bearer-auth';

// Export custom headers
export { CustomHeadersManager, predefinedGenerators } from './headers/index';

/**
 * High-level convenience function to parse and transform OpenAPI spec in one step
 * 
 * @param source - File path, URL, or string content
 * @param options - Parser and transformer options
 * @returns Promise resolving to MCP tools array
 * 
 * @example
 * ```typescript
 * // From file
 * const tools = await parseAndTransform('/path/to/swagger.json');
 * 
 * // From URL with options
 * const tools = await parseAndTransform('https://api.example.com/swagger.json', {
 *   parserConfig: { strictMode: false },
 *   transformerOptions: { baseUrl: 'https://api.example.com' }
 * });
 * 
 * // From string
 * const swaggerJson = '{"openapi": "3.0.0", ...}';
 * const tools = await parseAndTransform(swaggerJson, { isString: true });
 * ```
 */
export async function parseAndTransform(
  source: string,
  options: {
    isString?: boolean;
    isUrl?: boolean;
    parserConfig?: ParserConfig;
    transformerOptions?: TransformerOptions;
  } = {}
) {
  const { isString = false, isUrl = false, parserConfig, transformerOptions } = options;
  
  let parseResult;
  
  if (isString) {
    parseResult = await parseFromString(source, parserConfig);
  } else if (isUrl || source.startsWith('http://') || source.startsWith('https://')) {
    parseResult = await parseFromUrl(source, parserConfig);
  } else {
    parseResult = await parseFromFile(source, parserConfig);
  }
  
  return transformToMCPTools(parseResult.spec, transformerOptions);
}

/**
 * Package metadata
 */
export const VERSION = '1.0.0';
export const PACKAGE_NAME = 'mcp-swagger-parser';

/**
 * Default configurations
 */
export const DEFAULT_PARSER_CONFIG: ParserConfig = {
  validateSchema: true,
  resolveReferences: true,
  allowEmptyPaths: false,
  strictMode: false,
  customValidators: [],
  autoConvert: true,
  autoFix: true,
  swagger2Options: {
    patch: true,
    warnOnly: false,
    resolveInternal: false,
    targetVersion: '3.0.0',
    preserveRefs: true,
    warnProperty: 'x-s2o-warning',
    debug: false
  }
};

export const DEFAULT_TRANSFORMER_OPTIONS: TransformerOptions = {
  includeDeprecated: false,
  includeTags: [],
  excludeTags: [],
  requestTimeout: 30000,
  defaultHeaders: { 'Content-Type': 'application/json' },
  debugHeaders: false,
  protectedHeaders: ['content-type', 'content-length', 'host', 'connection', 'transfer-encoding', 'upgrade']
};
