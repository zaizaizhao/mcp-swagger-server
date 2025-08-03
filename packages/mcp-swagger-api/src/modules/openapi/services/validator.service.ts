import { Injectable, Logger } from '@nestjs/common';
import { parseFromString, ValidationError, ValidationWarning } from 'mcp-swagger-parser';

// Keep local interface for backward compatibility
export interface LocalValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

@Injectable()
export class ValidatorService {
  private readonly logger = new Logger(ValidatorService.name);

  async validateSpecification(spec: any): Promise<LocalValidationResult> {
    try {
      this.logger.log('Starting OpenAPI specification validation');

      // Use mcp-swagger-parser's parseFromString functionality (consistent with server package)
      const dataString = typeof spec === 'string' ? spec : JSON.stringify(spec);
      const parseResult = await parseFromString(dataString, {
        strictMode: false,
        resolveReferences: true,
        validateSchema: true
      });

      this.logger.log(`OpenAPI validation completed: ${parseResult.validation.valid ? 'valid' : 'invalid'} with ${parseResult.validation.errors.length} errors and ${parseResult.validation.warnings.length} warnings`);

      // Convert ValidationError[] and ValidationWarning[] to string[] for compatibility
      return {
        valid: parseResult.validation.valid,
        errors: parseResult.validation.errors.map((err: ValidationError) => err.message),
        warnings: parseResult.validation.warnings.map((warn: ValidationWarning) => warn.message)
      };
    } catch (error) {
      this.logger.error(`Error during OpenAPI validation: ${error.message}`, error.stack);
      return {
        valid: false,
        errors: [`Validation error: ${error.message}`],
        warnings: []
      };
    }
  }

  /**
   * Legacy validation method for backward compatibility
   */
  async validateSpecificationLegacy(spec: any): Promise<LocalValidationResult> {
    const result = await this.validateSpecification(spec);
    return {
      valid: result.valid,
      errors: result.errors,
      warnings: result.warnings
    };
  }
}
