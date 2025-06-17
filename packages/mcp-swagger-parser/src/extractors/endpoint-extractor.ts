/**
 * Endpoint extractor for OpenAPI specifications
 */

import type { 
  OpenAPISpec, 
  ApiEndpoint, 
  ParameterObject,
  RequestBodyObject,
  ResponsesObject,
  SecurityRequirementObject 
} from '../types/index.js';

export class EndpointExtractor {
  /**
   * Extract all endpoints from OpenAPI specification
   */
  static extractEndpoints(spec: OpenAPISpec): ApiEndpoint[] {
    const endpoints: ApiEndpoint[] = [];

    if (!spec.paths) {
      return endpoints;
    }

    for (const [path, pathItem] of Object.entries(spec.paths)) {
      const methods = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options', 'trace'] as const;
      
      for (const method of methods) {
        const operation = pathItem[method];
        if (!operation) continue;

        const endpoint: ApiEndpoint = {
          path,
          method: method.toUpperCase() as ApiEndpoint['method'],
          operationId: operation.operationId,
          summary: operation.summary,
          description: operation.description,
          parameters: this.extractParameters(operation.parameters || []),
          requestBody: operation.requestBody && !this.isReferenceObject(operation.requestBody) 
            ? operation.requestBody 
            : undefined,
          responses: operation.responses || {},
          tags: operation.tags,
          deprecated: operation.deprecated,
          security: operation.security
        };

        endpoints.push(endpoint);
      }
    }

    return endpoints;
  }

  /**
   * Extract parameters from operation
   */
  private static extractParameters(parameters: (ParameterObject | { $ref: string })[]): ParameterObject[] {
    return parameters.filter(param => !this.isReferenceObject(param)) as ParameterObject[];
  }

  /**
   * Check if object is a reference
   */
  private static isReferenceObject(obj: any): obj is { $ref: string } {
    return obj && typeof obj === 'object' && '$ref' in obj;
  }

  /**
   * Filter endpoints by criteria
   */
  static filterEndpoints(
    endpoints: ApiEndpoint[], 
    criteria: {
      methods?: string[];
      tags?: string[];
      includeDeprecated?: boolean;
      operationIds?: string[];
    }
  ): ApiEndpoint[] {
    return endpoints.filter(endpoint => {
      // Filter by HTTP method
      if (criteria.methods && !criteria.methods.includes(endpoint.method)) {
        return false;
      }

      // Filter by tags
      if (criteria.tags && criteria.tags.length > 0) {
        const endpointTags = endpoint.tags || [];
        const hasMatchingTag = criteria.tags.some(tag => endpointTags.includes(tag));
        if (!hasMatchingTag) {
          return false;
        }
      }

      // Filter deprecated endpoints
      if (!criteria.includeDeprecated && endpoint.deprecated) {
        return false;
      }

      // Filter by operation IDs
      if (criteria.operationIds && criteria.operationIds.length > 0) {
        if (!endpoint.operationId || !criteria.operationIds.includes(endpoint.operationId)) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Group endpoints by tag
   */
  static groupEndpointsByTag(endpoints: ApiEndpoint[]): Record<string, ApiEndpoint[]> {
    const grouped: Record<string, ApiEndpoint[]> = {};

    for (const endpoint of endpoints) {
      const tags = endpoint.tags || ['untagged'];
      
      for (const tag of tags) {
        if (!grouped[tag]) {
          grouped[tag] = [];
        }
        grouped[tag].push(endpoint);
      }
    }

    return grouped;
  }

  /**
   * Get endpoint statistics
   */
  static getEndpointStats(endpoints: ApiEndpoint[]) {
    const stats = {
      total: endpoints.length,
      byMethod: {} as Record<string, number>,
      deprecated: 0,
      withAuth: 0,
      tags: new Set<string>()
    };

    for (const endpoint of endpoints) {
      // Count by method
      stats.byMethod[endpoint.method] = (stats.byMethod[endpoint.method] || 0) + 1;

      // Count deprecated
      if (endpoint.deprecated) {
        stats.deprecated++;
      }

      // Count with authentication
      if (endpoint.security && endpoint.security.length > 0) {
        stats.withAuth++;
      }

      // Collect tags
      if (endpoint.tags) {
        endpoint.tags.forEach(tag => stats.tags.add(tag));
      }
    }

    return {
      ...stats,
      tags: Array.from(stats.tags)
    };
  }
}
