/**
 * Input types for the parser
 */

import type { ValidationResult } from './validation';

export interface ParserOptions {
  validateInput?: boolean;
  resolveRefs?: boolean;
  allowEmpty?: boolean;
  strictMode?: boolean;
  customValidators?: ValidationRule[];
}

export interface ParseFromUrlOptions {
  timeout?: number;
  headers?: Record<string, string>;
  validateCertificate?: boolean;
}

export interface ParseFromFileOptions {
  encoding?: BufferEncoding;
  allowedExtensions?: string[];
}

export interface ParseFromTextOptions {
  format?: 'json' | 'yaml' | 'auto';
  filename?: string;
}

export interface ValidationRule {
  name: string;
  validate: (spec: any) => ValidationResult;
}

export interface InputSource {
  type: 'url' | 'file' | 'text';
  content: string;
  options?: any;
}
