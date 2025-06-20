/**
 * OpenAPI specification validator
 */

import SwaggerParser from '@apidevtools/swagger-parser';
import type { 
  OpenAPISpec, 
  ValidationResult, 
  ValidationError,   ValidationWarning,
  ParserConfig 
} from '../types/index';

export class Validator {
  private config: ParserConfig;

  constructor(config: ParserConfig) {
    this.config = config;
  }

  /**
   * Validate OpenAPI specification
   */
  async validate(spec: OpenAPISpec): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Basic structure validation
    this.validateBasicStructure(spec, errors, warnings);

    // Schema validation using swagger-parser if enabled
    if (this.config.validateSchema) {
      try {
        await SwaggerParser.validate(spec as any);
      } catch (error) {
        if (error instanceof Error) {
          errors.push({
            path: 'root',
            message: error.message,
            code: 'SCHEMA_VALIDATION_ERROR',
            severity: 'error'
          });
        }
      }
    }

    // Custom validators
    if (this.config.customValidators) {
      for (const validator of this.config.customValidators) {
        try {
          const result = validator.validate(spec);
          errors.push(...result.errors);
          warnings.push(...result.warnings);
        } catch (error) {
          warnings.push({
            path: 'root',
            message: `Custom validator '${validator.name}' failed: ${error instanceof Error ? error.message : String(error)}`,
            code: 'CUSTOM_VALIDATOR_ERROR',
            severity: 'warning'
          });
        }
      }
    }    return {
      valid: errors.length === 0,
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate basic OpenAPI specification structure
   */
  private validateBasicStructure(
    spec: OpenAPISpec,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    // Check required fields
    if (!spec.openapi) {
      errors.push({
        path: 'openapi',
        message: 'Missing required field: openapi',
        code: 'MISSING_REQUIRED_FIELD',
        severity: 'error'
      });
    } else if (!spec.openapi.startsWith('3.')) {
      warnings.push({
        path: 'openapi',
        message: 'Only OpenAPI 3.x is fully supported',
        code: 'UNSUPPORTED_VERSION',
        severity: 'warning'
      });
    }

    if (!spec.info) {
      errors.push({
        path: 'info',
        message: 'Missing required field: info',
        code: 'MISSING_REQUIRED_FIELD',
        severity: 'error'
      });
    } else {
      if (!spec.info.title) {
        errors.push({
          path: 'info.title',
          message: 'Missing required field: info.title',
          code: 'MISSING_REQUIRED_FIELD',
          severity: 'error'
        });
      }
      if (!spec.info.version) {
        errors.push({
          path: 'info.version',
          message: 'Missing required field: info.version',
          code: 'MISSING_REQUIRED_FIELD',
          severity: 'error'
        });
      }
    }

    if (!spec.paths) {
      errors.push({
        path: 'paths',
        message: 'Missing required field: paths',
        code: 'MISSING_REQUIRED_FIELD',
        severity: 'error'
      });
    } else if (Object.keys(spec.paths).length === 0 && !this.config.allowEmptyPaths) {
      warnings.push({
        path: 'paths',
        message: 'No paths defined in specification',
        code: 'EMPTY_PATHS',
        severity: 'warning'
      });
    }

    // Validate paths
    if (spec.paths) {
      for (const [path, pathItem] of Object.entries(spec.paths)) {
        if (!path.startsWith('/')) {
          errors.push({
            path: `paths.${path}`,
            message: 'Path must start with forward slash',
            code: 'INVALID_PATH_FORMAT',
            severity: 'error'
          });
        }

        // Check for operations
        const hasOperations = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options', 'trace']
          .some(method => pathItem[method as keyof typeof pathItem]);

        if (!hasOperations && !pathItem.$ref) {
          warnings.push({
            path: `paths.${path}`,
            message: 'Path item has no operations defined',
            code: 'NO_OPERATIONS',
            severity: 'warning'
          });
        }
      }
    }
  }
}
