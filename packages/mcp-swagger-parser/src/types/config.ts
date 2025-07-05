/**
 * Configuration types for the parser
 */

import type { ValidationRule } from './input';

export interface ParserConfig {
  validateSchema?: boolean;
  resolveReferences?: boolean;
  allowEmptyPaths?: boolean;
  strictMode?: boolean;
  customValidators?: ValidationRule[];
  // Enhanced options for Swagger 2.0 support
  autoConvert?: boolean;
  autoFix?: boolean;
  swagger2Options?: Swagger2ConversionOptions;
}

/**
 * Configuration options for Swagger 2.0 to OpenAPI 3.0 conversion
 */
export interface Swagger2ConversionOptions {
  /** Fix up small errors in the source definition */
  patch?: boolean;
  /** Do not throw on non-patchable errors, add warning extensions */
  warnOnly?: boolean;
  /** Resolve internal references also */
  resolveInternal?: boolean;
  /** Override default target version of 3.0.0 */
  targetVersion?: string;
  /** Preserve $ref siblings */
  preserveRefs?: boolean;
  /** Property name to use for warning extensions */
  warnProperty?: string;
  /** Enable debug mode, adds specification-extensions */
  debug?: boolean;
}

export interface ParseOptions {
  timeout?: number;
  encoding?: BufferEncoding;
  allowedExtensions?: string[];
  headers?: Record<string, string>;
  validateCertificate?: boolean;
  format?: 'json' | 'yaml' | 'auto';
  filename?: string;
}

export interface ValidatorConfig {
  strictMode?: boolean;
  allowPartialSpecs?: boolean;
  customRules?: ValidationRule[];
  ignoreWarnings?: boolean;
}

export interface NormalizerConfig {
  resolveReferences?: boolean;
  flattenSchemas?: boolean;
  removeUnused?: boolean;
  optimizeForMCP?: boolean;
}

export interface ExtractorConfig {
  includeDeprecated?: boolean;
  includeTags?: string[];
  excludeTags?: string[];
  includeOperationIds?: string[];
  excludeOperationIds?: string[];
  filterMethods?: ('GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS' | 'TRACE')[];
}

export interface ParserSettings {
  parser: ParserConfig;
  validator: ValidatorConfig;
  normalizer: NormalizerConfig;
  extractor: ExtractorConfig;
}
