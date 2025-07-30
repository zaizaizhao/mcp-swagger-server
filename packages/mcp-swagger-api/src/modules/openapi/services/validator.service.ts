import { Injectable, Logger } from '@nestjs/common';
import { validate as parserValidate, ValidationResult } from 'mcp-swagger-parser';

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

      // Use mcp-swagger-parser's validation functionality
      const result = await parserValidate(spec);

      this.logger.log(`OpenAPI validation completed: ${result.valid ? 'valid' : 'invalid'} with ${result.errors.length} errors and ${result.warnings.length} warnings`);

      // Convert ValidationError[] to string[] for compatibility
      return {
        valid: result.valid,
        errors: result.errors.map(err => err.message),
        warnings: result.warnings.map(warn => warn.message)
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

  private isValidOpenAPIVersion(version: string): boolean {
    // Support OpenAPI 3.0.x and 3.1.x
    return /^3\.[01]\.\d+$/.test(version);
  }

  private isValidSwaggerVersion(version: string): boolean {
    // Support Swagger 2.0
    return version === '2.0';
  }

  private validateInfo(info: any, errors: string[], warnings: string[]): void {
    if (!info) {
      errors.push('Missing required "info" object');
      return;
    }

    if (typeof info !== 'object') {
      errors.push('"info" must be an object');
      return;
    }

    if (!info.title) {
      errors.push('Missing required "info.title" field');
    } else if (typeof info.title !== 'string') {
      errors.push('"info.title" must be a string');
    }

    if (!info.version) {
      errors.push('Missing required "info.version" field');
    } else if (typeof info.version !== 'string') {
      errors.push('"info.version" must be a string');
    }

    if (info.description && typeof info.description !== 'string') {
      warnings.push('"info.description" should be a string');
    }

    if (info.termsOfService && typeof info.termsOfService !== 'string') {
      warnings.push('"info.termsOfService" should be a string');
    }

    if (info.contact && typeof info.contact !== 'object') {
      warnings.push('"info.contact" should be an object');
    }

    if (info.license && typeof info.license !== 'object') {
      warnings.push('"info.license" should be an object');
    }
  }

  private validatePaths(paths: any, errors: string[], warnings: string[]): void {
    if (!paths) {
      errors.push('Missing required "paths" object');
      return;
    }

    if (typeof paths !== 'object') {
      errors.push('"paths" must be an object');
      return;
    }

    // Check if paths is an array (common mistake)
    if (Array.isArray(paths)) {
      errors.push('"paths" must be an object, not an array. Each path should be a property key (e.g., "/users", "/pets/{id}")');
      return;
    }

    const pathKeys = Object.keys(paths);
    if (pathKeys.length === 0) {
      warnings.push('No paths defined in the specification');
      return;
    }

    for (const pathKey of pathKeys) {
      if (!pathKey.startsWith('/')) {
        errors.push(`Path "${pathKey}" must start with "/"`);
      }

      const pathItem = paths[pathKey];
      if (typeof pathItem !== 'object') {
        errors.push(`Path item for "${pathKey}" must be an object`);
        continue;
      }

      this.validatePathItem(pathKey, pathItem, errors, warnings);
    }
  }

  private validatePathItem(path: string, pathItem: any, errors: string[], warnings: string[]): void {
    const httpMethods = ['get', 'post', 'put', 'delete', 'options', 'head', 'patch', 'trace'];
    
    let hasOperations = false;
    for (const method of httpMethods) {
      if (pathItem[method]) {
        hasOperations = true;
        this.validateOperation(path, method, pathItem[method], errors, warnings);
      }
    }

    if (!hasOperations) {
      warnings.push(`Path "${path}" has no HTTP operations defined`);
    }
  }

  private validateOperation(path: string, method: string, operation: any, errors: string[], warnings: string[]): void {
    if (typeof operation !== 'object') {
      errors.push(`Operation ${method.toUpperCase()} for path "${path}" must be an object`);
      return;
    }

    // Validate operationId
    if (operation.operationId && typeof operation.operationId !== 'string') {
      errors.push(`Operation ${method.toUpperCase()} for path "${path}" operationId must be a string`);
    }

    // Validate summary
    if (operation.summary && typeof operation.summary !== 'string') {
      warnings.push(`Operation ${method.toUpperCase()} for path "${path}" summary should be a string`);
    }

    // Validate description
    if (operation.description && typeof operation.description !== 'string') {
      warnings.push(`Operation ${method.toUpperCase()} for path "${path}" description should be a string`);
    }

    // Validate tags
    if (operation.tags && !Array.isArray(operation.tags)) {
      warnings.push(`Operation ${method.toUpperCase()} for path "${path}" tags should be an array`);
    }

    // Validate parameters
    if (operation.parameters && !Array.isArray(operation.parameters)) {
      errors.push(`Operation ${method.toUpperCase()} for path "${path}" parameters must be an array`);
    }

    // Validate responses
    if (!operation.responses) {
      errors.push(`Operation ${method.toUpperCase()} for path "${path}" is missing required "responses" object`);
    } else if (typeof operation.responses !== 'object') {
      errors.push(`Operation ${method.toUpperCase()} for path "${path}" responses must be an object`);
    }
  }

  private validateServers(servers: any, errors: string[], warnings: string[]): void {
    if (!Array.isArray(servers)) {
      errors.push('"servers" must be an array');
      return;
    }

    if (servers.length === 0) {
      warnings.push('No servers defined');
      return;
    }

    for (let i = 0; i < servers.length; i++) {
      const server = servers[i];
      if (typeof server !== 'object') {
        errors.push(`Server at index ${i} must be an object`);
        continue;
      }

      if (!server.url) {
        errors.push(`Server at index ${i} is missing required "url" field`);
      } else if (typeof server.url !== 'string') {
        errors.push(`Server at index ${i} "url" must be a string`);
      }

      if (server.description && typeof server.description !== 'string') {
        warnings.push(`Server at index ${i} "description" should be a string`);
      }
    }
  }

  private validateComponents(components: any, errors: string[], warnings: string[]): void {
    if (typeof components !== 'object') {
      errors.push('"components" must be an object');
      return;
    }

    // Validate schemas
    if (components.schemas && typeof components.schemas !== 'object') {
      errors.push('"components.schemas" must be an object');
    }

    // Validate responses
    if (components.responses && typeof components.responses !== 'object') {
      errors.push('"components.responses" must be an object');
    }

    // Validate parameters
    if (components.parameters && typeof components.parameters !== 'object') {
      errors.push('"components.parameters" must be an object');
    }

    // Validate requestBodies
    if (components.requestBodies && typeof components.requestBodies !== 'object') {
      errors.push('"components.requestBodies" must be an object');
    }

    // Validate headers
    if (components.headers && typeof components.headers !== 'object') {
      errors.push('"components.headers" must be an object');
    }

    // Validate securitySchemes
    if (components.securitySchemes && typeof components.securitySchemes !== 'object') {
      errors.push('"components.securitySchemes" must be an object');
    }
  }

  private validateDefinitions(definitions: any, errors: string[], warnings: string[]): void {
    if (typeof definitions !== 'object') {
      errors.push('"definitions" must be an object');
      return;
    }

    const definitionKeys = Object.keys(definitions);
    if (definitionKeys.length === 0) {
      warnings.push('No definitions found');
    }

    for (const key of definitionKeys) {
      const definition = definitions[key];
      if (typeof definition !== 'object') {
        errors.push(`Definition "${key}" must be an object`);
      }
    }
  }
}
