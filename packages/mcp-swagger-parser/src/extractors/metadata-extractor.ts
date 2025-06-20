/**
 * Metadata extractor for OpenAPI specifications
 */

import type { OpenAPISpec, TagObject, ExternalDocumentationObject } from '../types/index';

export interface ApiMetadata {
  info: {
    title: string;
    version: string;
    description?: string;
    contact?: {
      name?: string;
      url?: string;
      email?: string;
    };
    license?: {
      name: string;
      url?: string;
    };
    termsOfService?: string;
  };
  servers: {
    url: string;
    description?: string;
    variables?: Record<string, {
      enum?: string[];
      default: string;
      description?: string;
    }>;
  }[];
  tags: TagObject[];
  externalDocs?: ExternalDocumentationObject;
  statistics: {
    pathCount: number;
    operationCount: number;
    schemaCount: number;
    securitySchemeCount: number;
    parameterCount: number;
    responseCount: number;
    operationsByMethod: Record<string, number>;
    operationsByTag: Record<string, number>;
    deprecatedOperations: number;
  };
}

export class MetadataExtractor {
  /**
   * Extract comprehensive metadata from OpenAPI specification
   */
  static extractMetadata(spec: OpenAPISpec): ApiMetadata {
    return {
      info: this.extractInfo(spec),
      servers: this.extractServers(spec),
      tags: this.extractTags(spec),
      externalDocs: spec.externalDocs,
      statistics: this.calculateStatistics(spec)
    };
  }

  /**
   * Extract API information
   */
  private static extractInfo(spec: OpenAPISpec): ApiMetadata['info'] {
    return {
      title: spec.info.title,
      version: spec.info.version,
      description: spec.info.description,
      contact: spec.info.contact,
      license: spec.info.license,
      termsOfService: spec.info.termsOfService
    };
  }

  /**
   * Extract server information
   */
  private static extractServers(spec: OpenAPISpec): ApiMetadata['servers'] {
    if (!spec.servers || spec.servers.length === 0) {
      return [{
        url: 'http://localhost',
        description: 'Default server (no servers specified)'
      }];
    }

    return spec.servers.map(server => ({
      url: server.url,
      description: server.description,
      variables: server.variables
    }));
  }

  /**
   * Extract tag information
   */
  private static extractTags(spec: OpenAPISpec): TagObject[] {
    const definedTags = spec.tags || [];
    const usedTags = new Set<string>();

    // Collect tags used in operations
    if (spec.paths) {
      for (const pathItem of Object.values(spec.paths)) {
        const methods = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options', 'trace'] as const;
        
        for (const method of methods) {
          const operation = pathItem[method];
          if (operation?.tags) {
            operation.tags.forEach(tag => usedTags.add(tag));
          }
        }
      }
    }

    // Combine defined tags with used tags
    const allTags = new Map<string, TagObject>();

    // Add defined tags
    definedTags.forEach(tag => {
      allTags.set(tag.name, tag);
    });

    // Add used but not defined tags
    usedTags.forEach(tagName => {
      if (!allTags.has(tagName)) {
        allTags.set(tagName, {
          name: tagName,
          description: `Tag used in operations (not defined in global tags)`
        });
      }
    });

    return Array.from(allTags.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Calculate comprehensive statistics
   */
  private static calculateStatistics(spec: OpenAPISpec): ApiMetadata['statistics'] {
    const stats: ApiMetadata['statistics'] = {
      pathCount: 0,
      operationCount: 0,
      schemaCount: 0,
      securitySchemeCount: 0,
      parameterCount: 0,
      responseCount: 0,
      operationsByMethod: {},
      operationsByTag: {},
      deprecatedOperations: 0
    };

    // Count paths and operations
    if (spec.paths) {
      stats.pathCount = Object.keys(spec.paths).length;

      for (const pathItem of Object.values(spec.paths)) {
        const methods = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options', 'trace'] as const;
        
        for (const method of methods) {
          const operation = pathItem[method];
          if (!operation) continue;

          stats.operationCount++;

          // Count by method
          const methodUpper = method.toUpperCase();
          stats.operationsByMethod[methodUpper] = (stats.operationsByMethod[methodUpper] || 0) + 1;

          // Count by tag
          if (operation.tags) {
            operation.tags.forEach(tag => {
              stats.operationsByTag[tag] = (stats.operationsByTag[tag] || 0) + 1;
            });
          } else {
            stats.operationsByTag['untagged'] = (stats.operationsByTag['untagged'] || 0) + 1;
          }

          // Count deprecated operations
          if (operation.deprecated) {
            stats.deprecatedOperations++;
          }

          // Count parameters
          if (operation.parameters) {
            stats.parameterCount += operation.parameters.length;
          }

          // Count responses
          if (operation.responses) {
            stats.responseCount += Object.keys(operation.responses).length;
          }
        }

        // Count path-level parameters
        if (pathItem.parameters) {
          stats.parameterCount += pathItem.parameters.length;
        }
      }
    }

    // Count components
    if (spec.components) {
      stats.schemaCount = Object.keys(spec.components.schemas || {}).length;
      stats.securitySchemeCount = Object.keys(spec.components.securitySchemes || {}).length;
      stats.parameterCount += Object.keys(spec.components.parameters || {}).length;
      stats.responseCount += Object.keys(spec.components.responses || {}).length;
    }

    return stats;
  }

  /**
   * Generate API summary
   */
  static generateSummary(metadata: ApiMetadata): string {
    const { info, statistics } = metadata;
    
    const lines = [
      `# ${info.title} (v${info.version})`,
      ''
    ];

    if (info.description) {
      lines.push(info.description, '');
    }

    lines.push(
      '## API Statistics',
      `- **Paths**: ${statistics.pathCount}`,
      `- **Operations**: ${statistics.operationCount}`,
      `- **Schemas**: ${statistics.schemaCount}`,
      `- **Security Schemes**: ${statistics.securitySchemeCount}`,
      ''
    );

    if (statistics.deprecatedOperations > 0) {
      lines.push(`⚠️  **Deprecated Operations**: ${statistics.deprecatedOperations}`, '');
    }

    // Operations by method
    if (Object.keys(statistics.operationsByMethod).length > 0) {
      lines.push('## Operations by Method');
      Object.entries(statistics.operationsByMethod)
        .sort(([, a], [, b]) => b - a)
        .forEach(([method, count]) => {
          lines.push(`- **${method}**: ${count}`);
        });
      lines.push('');
    }

    // Operations by tag
    if (Object.keys(statistics.operationsByTag).length > 0) {
      lines.push('## Operations by Tag');
      Object.entries(statistics.operationsByTag)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10) // Show top 10 tags
        .forEach(([tag, count]) => {
          lines.push(`- **${tag}**: ${count}`);
        });
      lines.push('');
    }

    // Servers
    if (metadata.servers.length > 0) {
      lines.push('## Servers');
      metadata.servers.forEach(server => {
        const desc = server.description ? ` - ${server.description}` : '';
        lines.push(`- ${server.url}${desc}`);
      });
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Validate metadata completeness
   */
  static validateMetadata(metadata: ApiMetadata): {
    score: number;
    suggestions: string[];
  } {
    let score = 0;
    const maxScore = 100;
    const suggestions: string[] = [];

    // Check basic info completeness (40 points)
    if (metadata.info.description) score += 10;
    else suggestions.push('Add API description');

    if (metadata.info.contact) score += 10;
    else suggestions.push('Add contact information');

    if (metadata.info.license) score += 10;
    else suggestions.push('Add license information');

    if (metadata.info.termsOfService) score += 10;
    else suggestions.push('Add terms of service');

    // Check documentation (20 points)
    if (metadata.externalDocs) score += 10;
    else suggestions.push('Add external documentation links');

    const taggedOperations = Object.values(metadata.statistics.operationsByTag)
      .reduce((sum, count) => sum + count, 0) - (metadata.statistics.operationsByTag['untagged'] || 0);
    
    if (taggedOperations === metadata.statistics.operationCount) score += 10;
    else suggestions.push('Tag all operations for better organization');

    // Check operation quality (20 points)
    const deprecatedRatio = metadata.statistics.deprecatedOperations / metadata.statistics.operationCount;
    if (deprecatedRatio < 0.1) score += 10;
    else suggestions.push('Reduce number of deprecated operations');

    if (metadata.statistics.operationCount > 0) score += 10;

    // Check server configuration (10 points)
    const hasProductionServer = metadata.servers.some(server => 
      !server.url.includes('localhost') && !server.url.includes('127.0.0.1')
    );
    if (hasProductionServer) score += 10;
    else suggestions.push('Add production server URL');

    // Check security (10 points)
    if (metadata.statistics.securitySchemeCount > 0) score += 10;
    else suggestions.push('Define security schemes');

    return {
      score: Math.round((score / maxScore) * 100),
      suggestions
    };
  }
}
