/**
 * Text parser for OpenAPI specifications
 */

import type { OpenAPISpec } from '../types/index';
import { OpenAPIParseError, ERROR_CODES } from '../errors/index';
import { BaseParser } from './base-parser';

export interface TextParseOptions {
  format?: 'json' | 'yaml' | 'auto';
  filename?: string;
}

export class TextParser extends BaseParser {
  /**
   * Parse OpenAPI specification from text content
   */
  async parse(content: string, options: TextParseOptions = {}): Promise<OpenAPISpec> {
    if (!content || typeof content !== 'string') {
      throw new OpenAPIParseError(
        'Content must be a non-empty string',
        ERROR_CODES.INVALID_FORMAT
      );
    }

    try {
      let spec: any;
      const format = options.format || 'auto';

      if (format === 'json') {
        spec = this.parseJson(content);
      } else if (format === 'yaml') {
        spec = await this.parseYaml(content);
      } else {
        // Auto-detect format
        const detectedFormat = this.detectFormat(content);
        if (detectedFormat === 'json') {
          spec = this.parseJson(content);
        } else {
          spec = await this.parseYaml(content);
        }
      }

      // Validate basic structure
      this.validateBasicStructure(spec);

      return spec as OpenAPISpec;

    } catch (error) {
      if (error instanceof OpenAPIParseError) {
        throw error;
      }

      const source = options.filename || 'text content';
      throw new OpenAPIParseError(
        `Failed to parse ${source}: ${error instanceof Error ? error.message : String(error)}`,
        ERROR_CODES.PARSE_ERROR,
        source,
        error instanceof Error ? error : undefined
      );
    }
  }
}
