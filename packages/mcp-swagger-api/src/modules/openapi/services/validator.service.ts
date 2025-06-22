import { Injectable, Logger } from '@nestjs/common';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

@Injectable()
export class ValidatorService {
  private readonly logger = new Logger(ValidatorService.name);

  async validateSpecification(spec: any): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      this.logger.log('Starting OpenAPI specification validation');

      // Basic structure validation
      if (!spec) {
        errors.push('OpenAPI specification is empty or null');
        return { valid: false, errors, warnings };
      }

      if (typeof spec !== 'object') {
        errors.push('OpenAPI specification must be an object');
        return { valid: false, errors, warnings };
      }

      // Check OpenAPI version
      if (!spec.openapi && !spec.swagger) {
        errors.push('Missing OpenAPI or Swagger version field');
      } else if (spec.openapi) {
        if (!this.isValidOpenAPIVersion(spec.openapi)) {
          errors.push(`Unsupported OpenAPI version: ${spec.openapi}`);
        }
      } else if (spec.swagger) {
        if (!this.isValidSwaggerVersion(spec.swagger)) {
          errors.push(`Unsupported Swagger version: ${spec.swagger}`);
        }
      }

      // Validate info object
      this.validateInfo(spec.info, errors, warnings);

      // Validate paths
      this.validatePaths(spec.paths, errors, warnings);

      // Validate servers (OpenAPI 3.x only)
      if (spec.openapi && spec.servers) {
        this.validateServers(spec.servers, errors, warnings);
      }

      // Validate components (OpenAPI 3.x only)
      if (spec.openapi && spec.components) {
        this.validateComponents(spec.components, errors, warnings);
      }

      // Validate definitions (Swagger 2.0 only)
      if (spec.swagger && spec.definitions) {
        this.validateDefinitions(spec.definitions, errors, warnings);
      }

      const valid = errors.length === 0;
      this.logger.log(`OpenAPI validation completed: ${valid ? 'valid' : 'invalid'} with ${errors.length} errors and ${warnings.length} warnings`);

      return { valid, errors, warnings };
    } catch (error) {
      this.logger.error(`Error during OpenAPI validation: ${error.message}`, error.stack);
      errors.push(`Validation error: ${error.message}`);
      return { valid: false, errors, warnings };
    }
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
