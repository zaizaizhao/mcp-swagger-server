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
