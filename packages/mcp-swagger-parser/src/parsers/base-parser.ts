/**
 * Base parser class for OpenAPI specifications
 */

import type { OpenAPISpec } from '../types/index.js';
import { OpenAPIParseError, ERROR_CODES } from '../errors/index.js';

export abstract class BaseParser {
  /**
   * Parse OpenAPI specification from a source
   */
  abstract parse(source: string, options?: any): Promise<OpenAPISpec>;

  /**
   * Detect format of the content
   */
  protected detectFormat(content: string): 'json' | 'yaml' {
    const trimmed = content.trim();
    
    // Try to parse as JSON first
    try {
      JSON.parse(trimmed);
      return 'json';
    } catch {
      // If JSON parsing fails, assume it's YAML
      return 'yaml';
    }
  }

  /**
   * Parse JSON content
   */
  protected parseJson(content: string): any {
    try {
      return JSON.parse(content);
    } catch (error) {
      throw new OpenAPIParseError(
        `Invalid JSON format: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ERROR_CODES.INVALID_FORMAT,
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Parse YAML content
   */
  protected async parseYaml(content: string): Promise<any> {
    try {
      const { load } = await import('js-yaml');
      return load(content);
    } catch (error) {
      throw new OpenAPIParseError(
        `Invalid YAML format: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ERROR_CODES.INVALID_FORMAT,
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Validate basic OpenAPI structure
   */
  protected validateBasicStructure(spec: any): void {
    if (!spec || typeof spec !== 'object') {
      throw new OpenAPIParseError(
        'Invalid OpenAPI specification: must be an object',
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    if (!spec.openapi) {
      throw new OpenAPIParseError(
        'Missing required field: openapi',
        ERROR_CODES.VALIDATION_ERROR,
        'openapi'
      );
    }

    if (!spec.info) {
      throw new OpenAPIParseError(
        'Missing required field: info',
        ERROR_CODES.VALIDATION_ERROR,
        'info'
      );
    }

    if (!spec.paths) {
      throw new OpenAPIParseError(
        'Missing required field: paths',
        ERROR_CODES.VALIDATION_ERROR,
        'paths'
      );
    }
  }
}
