/**
 * File parser for OpenAPI specifications
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, extname } from 'path';
import type { OpenAPISpec } from '../types/index.js';
import { OpenAPIFileError, OpenAPIParseError, ERROR_CODES } from '../errors/index.js';
import { BaseParser } from './base-parser.js';

export interface FileParseOptions {
  encoding?: BufferEncoding;
  allowedExtensions?: string[];
}

export class FileParser extends BaseParser {
  private static readonly DEFAULT_ALLOWED_EXTENSIONS = ['.json', '.yaml', '.yml'];

  /**
   * Parse OpenAPI specification from file
   */
  async parse(filePath: string, options: FileParseOptions = {}): Promise<OpenAPISpec> {
    const resolvedPath = resolve(filePath);
    
    // Check if file exists
    if (!existsSync(resolvedPath)) {
      throw new OpenAPIFileError(
        `File not found: ${resolvedPath}`,
        resolvedPath
      );
    }

    // Validate file extension if specified
    const allowedExtensions = options.allowedExtensions || FileParser.DEFAULT_ALLOWED_EXTENSIONS;
    const ext = extname(resolvedPath).toLowerCase();
    
    if (allowedExtensions.length > 0 && !allowedExtensions.includes(ext)) {
      throw new OpenAPIParseError(
        `Unsupported file extension: ${ext}. Allowed extensions: ${allowedExtensions.join(', ')}`,
        ERROR_CODES.INVALID_FORMAT,
        resolvedPath
      );
    }

    try {
      // Read file content
      const content = readFileSync(resolvedPath, {
        encoding: options.encoding || 'utf8'
      });

      // Parse based on file extension
      let spec: any;
      
      if (ext === '.yaml' || ext === '.yml') {
        spec = await this.parseYaml(content);
      } else if (ext === '.json') {
        spec = this.parseJson(content);
      } else {
        // Auto-detect format for unknown extensions
        const format = this.detectFormat(content);
        if (format === 'json') {
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

      throw new OpenAPIFileError(
        `Failed to parse file: ${error instanceof Error ? error.message : String(error)}`,
        resolvedPath,
        error instanceof Error ? error : undefined
      );
    }
  }
}
