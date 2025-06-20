/**
 * URL parser for OpenAPI specifications
 */

import axios from 'axios';
import type { OpenAPISpec } from '../types/index';
import { OpenAPINetworkError, OpenAPIParseError, ERROR_CODES } from '../errors/index';
import { BaseParser } from './base-parser';

export interface UrlParseOptions {
  timeout?: number;
  headers?: Record<string, string>;
  validateCertificate?: boolean;
}

export class UrlParser extends BaseParser {
  /**
   * Parse OpenAPI specification from URL
   */
  async parse(url: string, options: UrlParseOptions = {}): Promise<OpenAPISpec> {
    // Validate URL format
    if (!this.isValidUrl(url)) {
      throw new OpenAPIParseError(
        `Invalid URL format: ${url}`,
        ERROR_CODES.INVALID_FORMAT,
        url
      );
    }

    try {
      const response = await axios.get(url, {
        timeout: options.timeout || 30000,
        headers: {
          'Accept': 'application/json, application/yaml, text/yaml, text/plain',
          ...options.headers
        },
        httpsAgent: options.validateCertificate === false ? {
          rejectUnauthorized: false
        } : undefined
      });

      // Determine content type and parse accordingly
      const contentType = response.headers['content-type'] || '';
      let spec: any;

      if (contentType.includes('yaml') || contentType.includes('yml')) {
        spec = await this.parseYaml(response.data);
      } else if (contentType.includes('json')) {
        spec = typeof response.data === 'string' ? this.parseJson(response.data) : response.data;
      } else {
        // Auto-detect format
        const content = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
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
      if (axios.isAxiosError(error)) {
        throw new OpenAPINetworkError(
          `Failed to fetch OpenAPI spec from URL: ${error.message}`,
          url,
          error.response?.status,
          error
        );
      }
      
      if (error instanceof OpenAPIParseError) {
        throw error;
      }

      throw new OpenAPIParseError(
        `Failed to parse OpenAPI spec from URL: ${error instanceof Error ? error.message : String(error)}`,
        ERROR_CODES.PARSE_ERROR,
        url,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Validate URL format
   */
  private isValidUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return ['http:', 'https:'].includes(parsed.protocol);
    } catch {
      return false;
    }
  }
}
