/**
 * Schema extractor for OpenAPI specifications
 */

import type { OpenAPISpec, SchemaObject, ComponentsObject } from '../types/index';

export interface ExtractedSchema {
  name: string;
  schema: SchemaObject;
  referencedBy: string[];
  dependencies: string[];
}

export class SchemaExtractor {
  /**
   * Extract all schemas from OpenAPI specification
   */
  static extractSchemas(spec: OpenAPISpec): ExtractedSchema[] {
    const schemas: ExtractedSchema[] = [];

    if (!spec.components?.schemas) {
      return schemas;
    }

    for (const [name, schema] of Object.entries(spec.components.schemas)) {
      if (this.isReferenceObject(schema)) {
        continue; // Skip references for now
      }

      const extracted: ExtractedSchema = {
        name,
        schema: schema as SchemaObject,
        referencedBy: this.findReferences(name, spec),
        dependencies: this.findDependencies(schema as SchemaObject)
      };

      schemas.push(extracted);
    }

    return schemas;
  }

  /**
   * Find where a schema is referenced
   */
  private static findReferences(schemaName: string, spec: OpenAPISpec): string[] {
    const references: string[] = [];
    const refPattern = `#/components/schemas/${schemaName}`;

    // Search in paths
    if (spec.paths) {
      for (const [path, pathItem] of Object.entries(spec.paths)) {
        const methods = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options', 'trace'] as const;
        
        for (const method of methods) {
          const operation = pathItem[method];
          if (!operation) continue;

          // Check parameters
          if (operation.parameters) {
            for (const param of operation.parameters) {
              if (this.containsReference(param, refPattern)) {
                references.push(`${method.toUpperCase()} ${path} (parameter)`);
              }
            }
          }

          // Check request body
          if (operation.requestBody && this.containsReference(operation.requestBody, refPattern)) {
            references.push(`${method.toUpperCase()} ${path} (request body)`);
          }

          // Check responses
          if (operation.responses) {
            for (const [status, response] of Object.entries(operation.responses)) {
              if (this.containsReference(response, refPattern)) {
                references.push(`${method.toUpperCase()} ${path} (response ${status})`);
              }
            }
          }
        }
      }
    }

    // Search in other schemas
    if (spec.components?.schemas) {
      for (const [otherSchemaName, otherSchema] of Object.entries(spec.components.schemas)) {
        if (otherSchemaName !== schemaName && this.containsReference(otherSchema, refPattern)) {
          references.push(`Schema: ${otherSchemaName}`);
        }
      }
    }

    return references;
  }

  /**
   * Find dependencies of a schema
   */
  private static findDependencies(schema: SchemaObject): string[] {
    const dependencies: string[] = [];

    this.traverseSchema(schema, (obj) => {
      if (this.isReferenceObject(obj) && obj.$ref.startsWith('#/components/schemas/')) {
        const schemaName = obj.$ref.replace('#/components/schemas/', '');
        if (!dependencies.includes(schemaName)) {
          dependencies.push(schemaName);
        }
      }
    });

    return dependencies;
  }

  /**
   * Traverse schema object recursively
   */
  private static traverseSchema(obj: any, callback: (obj: any) => void): void {
    if (!obj || typeof obj !== 'object') {
      return;
    }

    callback(obj);

    if (Array.isArray(obj)) {
      for (const item of obj) {
        this.traverseSchema(item, callback);
      }
    } else {
      for (const value of Object.values(obj)) {
        this.traverseSchema(value, callback);
      }
    }
  }

  /**
   * Check if object contains a specific reference
   */
  private static containsReference(obj: any, refPattern: string): boolean {
    let found = false;

    this.traverseSchema(obj, (item) => {
      if (this.isReferenceObject(item) && item.$ref === refPattern) {
        found = true;
      }
    });

    return found;
  }

  /**
   * Check if object is a reference
   */
  private static isReferenceObject(obj: any): obj is { $ref: string } {
    return obj && typeof obj === 'object' && '$ref' in obj;
  }

  /**
   * Get schema statistics
   */
  static getSchemaStats(schemas: ExtractedSchema[]) {
    const stats = {
      total: schemas.length,
      withDependencies: 0,
      orphaned: 0,
      mostReferenced: { name: '', count: 0 },
      byType: {} as Record<string, number>
    };

    for (const schema of schemas) {
      // Count schemas with dependencies
      if (schema.dependencies.length > 0) {
        stats.withDependencies++;
      }

      // Count orphaned schemas (not referenced by anything)
      if (schema.referencedBy.length === 0) {
        stats.orphaned++;
      }

      // Find most referenced schema
      if (schema.referencedBy.length > stats.mostReferenced.count) {
        stats.mostReferenced = {
          name: schema.name,
          count: schema.referencedBy.length
        };
      }

      // Count by type
      const type = schema.schema.type || 'unknown';
      stats.byType[type] = (stats.byType[type] || 0) + 1;
    }

    return stats;
  }

  /**
   * Build dependency graph
   */
  static buildDependencyGraph(schemas: ExtractedSchema[]): Record<string, string[]> {
    const graph: Record<string, string[]> = {};

    for (const schema of schemas) {
      graph[schema.name] = schema.dependencies;
    }

    return graph;
  }

  /**
   * Find circular dependencies
   */
  static findCircularDependencies(schemas: ExtractedSchema[]): string[][] {
    const graph = this.buildDependencyGraph(schemas);
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const cycles: string[][] = [];

    const dfs = (node: string, path: string[]): void => {
      if (recursionStack.has(node)) {
        // Found a cycle
        const cycleStart = path.indexOf(node);
        if (cycleStart >= 0) {
          cycles.push(path.slice(cycleStart));
        }
        return;
      }

      if (visited.has(node)) {
        return;
      }

      visited.add(node);
      recursionStack.add(node);

      const dependencies = graph[node] || [];
      for (const dep of dependencies) {
        dfs(dep, [...path, dep]);
      }

      recursionStack.delete(node);
    };

    for (const schema of schemas) {
      if (!visited.has(schema.name)) {
        dfs(schema.name, [schema.name]);
      }
    }

    return cycles;
  }
}
