/**
 * Validation and error types used across the parser
 */

/**
 * Validation error information
 */
export interface ValidationError {
  code: string;
  message: string;
  path: string;
  line?: number;
  column?: number;
  context?: any;
  severity: 'error';
}

/**
 * Validation warning information
 */
export interface ValidationWarning {
  code: string;
  message: string;
  path: string;
  line?: number;
  column?: number;
  context?: any;
  severity: 'warning';
}

/**
 * Validation result containing errors and warnings
 */
export interface ValidationResult {
  valid: boolean;
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  metadata?: {
    validationTime: number;
    rulesApplied: string[];
    [key: string]: any;
  };
}
