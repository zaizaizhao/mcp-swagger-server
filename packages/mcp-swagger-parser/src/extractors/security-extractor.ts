/**
 * Security extractor for OpenAPI specifications
 */

import type { 
  OpenAPISpec, 
  SecuritySchemeObject, 
  SecurityRequirementObject,
  ReferenceObject 
} from '../types/index.js';

export interface ExtractedSecurityScheme {
  name: string;
  scheme: SecuritySchemeObject;
  usageCount: number;
  usedInOperations: string[];
}

export interface SecurityAnalysis {
  schemes: ExtractedSecurityScheme[];
  globalSecurity: SecurityRequirementObject[];
  operationSecurity: Record<string, SecurityRequirementObject[]>;
  unsecuredOperations: string[];
}

export class SecurityExtractor {
  /**
   * Extract all security information from OpenAPI specification
   */
  static extractSecurity(spec: OpenAPISpec): SecurityAnalysis {
    const schemes = this.extractSecuritySchemes(spec);
    const globalSecurity = spec.security || [];
    const operationSecurity = this.extractOperationSecurity(spec);
    const unsecuredOperations = this.findUnsecuredOperations(spec);

    return {
      schemes,
      globalSecurity,
      operationSecurity,
      unsecuredOperations
    };
  }

  /**
   * Extract security schemes from components
   */
  private static extractSecuritySchemes(spec: OpenAPISpec): ExtractedSecurityScheme[] {
    const schemes: ExtractedSecurityScheme[] = [];
    
    if (!spec.components?.securitySchemes) {
      return schemes;
    }

    const usageCounts = this.analyzeSecurityUsage(spec);

    for (const [name, scheme] of Object.entries(spec.components.securitySchemes)) {
      if (this.isReferenceObject(scheme)) {
        continue; // Skip reference objects
      }

      const extractedScheme: ExtractedSecurityScheme = {
        name,
        scheme,
        usageCount: usageCounts[name]?.count || 0,
        usedInOperations: usageCounts[name]?.operations || []
      };

      schemes.push(extractedScheme);
    }

    return schemes;
  }

  /**
   * Analyze security scheme usage throughout the specification
   */
  private static analyzeSecurityUsage(spec: OpenAPISpec): Record<string, { count: number; operations: string[] }> {
    const usage: Record<string, { count: number; operations: string[] }> = {};

    // Check global security
    if (spec.security) {
      for (const requirement of spec.security) {
        for (const schemeName of Object.keys(requirement)) {
          if (!usage[schemeName]) {
            usage[schemeName] = { count: 0, operations: [] };
          }
          usage[schemeName].count++;
        }
      }
    }

    // Check operation-level security
    if (spec.paths) {
      for (const [path, pathItem] of Object.entries(spec.paths)) {
        const methods = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options', 'trace'] as const;
        
        for (const method of methods) {
          const operation = pathItem[method];
          if (!operation) continue;

          const operationId = `${method.toUpperCase()} ${path}`;

          if (operation.security) {
            for (const requirement of operation.security) {
              for (const schemeName of Object.keys(requirement)) {
                if (!usage[schemeName]) {
                  usage[schemeName] = { count: 0, operations: [] };
                }
                usage[schemeName].count++;
                usage[schemeName].operations.push(operationId);
              }
            }
          }
        }
      }
    }

    return usage;
  }

  /**
   * Extract operation-level security requirements
   */
  private static extractOperationSecurity(spec: OpenAPISpec): Record<string, SecurityRequirementObject[]> {
    const operationSecurity: Record<string, SecurityRequirementObject[]> = {};

    if (!spec.paths) {
      return operationSecurity;
    }

    for (const [path, pathItem] of Object.entries(spec.paths)) {
      const methods = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options', 'trace'] as const;
      
      for (const method of methods) {
        const operation = pathItem[method];
        if (!operation) continue;

        const operationId = operation.operationId || `${method.toUpperCase()} ${path}`;
        
        if (operation.security) {
          operationSecurity[operationId] = operation.security;
        } else if (spec.security) {
          // Use global security if no operation-specific security
          operationSecurity[operationId] = spec.security;
        }
      }
    }

    return operationSecurity;
  }

  /**
   * Find operations without security requirements
   */
  private static findUnsecuredOperations(spec: OpenAPISpec): string[] {
    const unsecured: string[] = [];

    if (!spec.paths) {
      return unsecured;
    }

    const hasGlobalSecurity = spec.security && spec.security.length > 0;

    for (const [path, pathItem] of Object.entries(spec.paths)) {
      const methods = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options', 'trace'] as const;
      
      for (const method of methods) {
        const operation = pathItem[method];
        if (!operation) continue;

        const operationId = operation.operationId || `${method.toUpperCase()} ${path}`;
        
        // Check if operation has security
        const hasOperationSecurity = operation.security && operation.security.length > 0;
        const hasEmptyOperationSecurity = operation.security && operation.security.length === 0;
        
        if (hasEmptyOperationSecurity || (!hasOperationSecurity && !hasGlobalSecurity)) {
          unsecured.push(operationId);
        }
      }
    }

    return unsecured;
  }

  /**
   * Check if object is a reference
   */
  private static isReferenceObject(obj: any): obj is ReferenceObject {
    return obj && typeof obj === 'object' && '$ref' in obj;
  }

  /**
   * Get security scheme statistics
   */
  static getSecurityStats(analysis: SecurityAnalysis) {
    const stats = {
      totalSchemes: analysis.schemes.length,
      schemeTypes: {} as Record<string, number>,
      unusedSchemes: 0,
      globalSecurityCount: analysis.globalSecurity.length,
      unsecuredOperationsCount: analysis.unsecuredOperations.length,
      mostUsedScheme: null as string | null,
      leastUsedScheme: null as string | null
    };

    // Count scheme types
    for (const scheme of analysis.schemes) {
      const type = scheme.scheme.type;
      stats.schemeTypes[type] = (stats.schemeTypes[type] || 0) + 1;
      
      if (scheme.usageCount === 0) {
        stats.unusedSchemes++;
      }
    }

    // Find most and least used schemes
    if (analysis.schemes.length > 0) {
      const sortedByUsage = [...analysis.schemes].sort((a, b) => b.usageCount - a.usageCount);
      stats.mostUsedScheme = sortedByUsage[0].name;
      stats.leastUsedScheme = sortedByUsage[sortedByUsage.length - 1].name;
    }

    return stats;
  }

  /**
   * Validate security configuration
   */
  static validateSecurityConfig(analysis: SecurityAnalysis): {
    warnings: string[];
    recommendations: string[];
  } {
    const warnings: string[] = [];
    const recommendations: string[] = [];

    // Check for unused security schemes
    const unusedSchemes = analysis.schemes.filter(scheme => scheme.usageCount === 0);
    if (unusedSchemes.length > 0) {
      warnings.push(`Found ${unusedSchemes.length} unused security scheme(s): ${unusedSchemes.map(s => s.name).join(', ')}`);
    }

    // Check for unsecured operations
    if (analysis.unsecuredOperations.length > 0) {
      warnings.push(`Found ${analysis.unsecuredOperations.length} unsecured operation(s)`);
      recommendations.push('Consider adding security requirements to all operations');
    }

    // Check for weak authentication methods
    const weakSchemes = analysis.schemes.filter(scheme => 
      scheme.scheme.type === 'apiKey' && scheme.scheme.in === 'query'
    );
    if (weakSchemes.length > 0) {
      recommendations.push('Avoid using API keys in query parameters; use headers or cookies instead');
    }

    // Check for missing OAuth scopes documentation
    const oauthSchemes = analysis.schemes.filter(scheme => scheme.scheme.type === 'oauth2');
    for (const scheme of oauthSchemes) {
      if (scheme.scheme.flows) {
        const hasEmptyScopes = Object.values(scheme.scheme.flows).some(flow => 
          flow && Object.keys(flow.scopes || {}).length === 0
        );
        if (hasEmptyScopes) {
          recommendations.push(`OAuth2 scheme '${scheme.name}' should define scopes for better access control`);
        }
      }
    }

    return { warnings, recommendations };
  }
}
