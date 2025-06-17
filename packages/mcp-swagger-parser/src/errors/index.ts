/**
 * Custom error classes for OpenAPI parsing
 */

export class OpenAPIParseError extends Error {
  public readonly code: string;
  public readonly path?: string;
  public readonly cause?: Error;

  constructor(
    message: string,
    code: string,
    path?: string,
    cause?: Error
  ) {
    super(message);
    this.name = 'OpenAPIParseError';
    this.code = code;
    this.path = path;
    this.cause = cause;
  }
}

export class OpenAPIValidationError extends Error {
  public readonly errors: ValidationErrorDetail[];
  public readonly warnings: ValidationWarningDetail[];

  constructor(
    message: string,
    errors: ValidationErrorDetail[],
    warnings: ValidationWarningDetail[] = []
  ) {
    super(message);
    this.name = 'OpenAPIValidationError';
    this.errors = errors;
    this.warnings = warnings;
  }
}

export class OpenAPINetworkError extends Error {
  public readonly url: string;
  public readonly statusCode?: number;
  public readonly cause?: Error;

  constructor(
    message: string,
    url: string,
    statusCode?: number,
    cause?: Error
  ) {
    super(message);
    this.name = 'OpenAPINetworkError';
    this.url = url;
    this.statusCode = statusCode;
    this.cause = cause;
  }
}

export class OpenAPIFileError extends Error {
  public readonly filePath: string;
  public readonly cause?: Error;

  constructor(
    message: string,
    filePath: string,
    cause?: Error
  ) {
    super(message);
    this.name = 'OpenAPIFileError';
    this.filePath = filePath;
    this.cause = cause;
  }
}

export interface ValidationErrorDetail {
  path: string;
  message: string;
  code: string;
  severity: 'error';
}

export interface ValidationWarningDetail {
  path: string;
  message: string;
  code: string;
  severity: 'warning';
}

// Error codes constants
export const ERROR_CODES = {
  PARSE_ERROR: 'PARSE_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  INVALID_FORMAT: 'INVALID_FORMAT',
  REFERENCE_ERROR: 'REFERENCE_ERROR',
  SCHEMA_ERROR: 'SCHEMA_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR'
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];
