/**
 * OpenAPI specification normalizer
 */

import SwaggerParser from '@apidevtools/swagger-parser';
import type { OpenAPISpec, ParserConfig } from '../types/index';
import { OpenAPIParseError, ERROR_CODES } from '../errors/index';

export class Normalizer {
  private config: ParserConfig;

  constructor(config: ParserConfig) {
    this.config = config;
  }

  /**
   * Normalize OpenAPI specification
   */
  async normalize(spec: OpenAPISpec): Promise<OpenAPISpec> {
    let normalizedSpec = { ...spec };

    // Resolve references if enabled
    if (this.config.resolveReferences) {
      try {
        normalizedSpec = await SwaggerParser.dereference(normalizedSpec as any) as OpenAPISpec;
      } catch (error) {
        if (this.config.strictMode) {
          throw new OpenAPIParseError(
            `Failed to resolve references: ${error instanceof Error ? error.message : String(error)}`,
            ERROR_CODES.REFERENCE_ERROR,
            undefined,
            error instanceof Error ? error : undefined
          );
        }
        // In non-strict mode, continue with unresolved references
      }
    }

    // Additional normalization steps could be added here
    normalizedSpec = this.normalizeServers(normalizedSpec);
    normalizedSpec = this.normalizePaths(normalizedSpec);

    return normalizedSpec;
  }

  /**
   * Normalize server configurations
   */
  private normalizeServers(spec: OpenAPISpec): OpenAPISpec {
    if (!spec.servers || spec.servers.length === 0) {
      // Add default server if none specified
      spec.servers = [{
        url: 'http://localhost',
        description: 'Default server'
      }];
    }

    return spec;
  }

  /**
   * Normalize path definitions
   */
  private normalizePaths(spec: OpenAPISpec): OpenAPISpec {
    if (!spec.paths) {
      return spec;
    }

    const normalizedPaths: typeof spec.paths = {};

    for (const [path, pathItem] of Object.entries(spec.paths)) {
      // Ensure path starts with forward slash
      const normalizedPath = path.startsWith('/') ? path : `/${path}`;
      normalizedPaths[normalizedPath] = pathItem;
    }

    return {
      ...spec,
      paths: normalizedPaths
    };
  }
}
