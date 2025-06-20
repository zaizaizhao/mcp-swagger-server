/**
 * Enhanced utility functions for OpenAPI parsing and transformation
 */

import type { OpenAPISpec, SchemaObject, ReferenceObject, PathItemObject, TagObject } from '../types/index';

/**
 * Check if an object is a reference object
 */
export function isReferenceObject(obj: any): obj is ReferenceObject {
  return obj && typeof obj === 'object' && '$ref' in obj;
}

/**
 * Extract operation count from OpenAPI spec
 */
export function getOperationCount(spec: OpenAPISpec): number {
  let count = 0;
  if (spec.paths) {
    for (const pathItem of Object.values(spec.paths)) {
      const methods = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options', 'trace'] as const;
      count += methods.filter(method => pathItem[method]).length;
    }
  }
  return count;
}

/**
 * Extract path count from OpenAPI spec
 */
export function getPathCount(spec: OpenAPISpec): number {
  return spec.paths ? Object.keys(spec.paths).length : 0;
}

/**
 * Extract schema count from OpenAPI spec
 */
export function getSchemaCount(spec: OpenAPISpec): number {
  return spec.components?.schemas ? Object.keys(spec.components.schemas).length : 0;
}

/**
 * Get all tags from OpenAPI spec
 */
export function getAllTags(spec: OpenAPISpec): string[] {
  const tags = new Set<string>();
  
  // From global tags
  if (spec.tags) {
    spec.tags.forEach(tag => tags.add(tag.name));
  }
  
  // From operations
  if (spec.paths) {
    for (const pathItem of Object.values(spec.paths)) {
      const methods = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options', 'trace'] as const;
      methods.forEach(method => {
        const operation = pathItem[method];
        if (operation && typeof operation === 'object' && 'tags' in operation && operation.tags) {
          operation.tags.forEach((tag: string) => tags.add(tag));
        }
      });
    }
  }
  
  return Array.from(tags).sort();
}

/**
 * Normalize OpenAPI version string
 */
export function normalizeVersion(version: string): string {
  const match = version.match(/(\d+\.\d+(?:\.\d+)?)/);
  return match ? match[1] : version;
}

/**
 * Check if OpenAPI version is supported
 */
export function isSupportedVersion(version: string): boolean {
  const normalized = normalizeVersion(version);
  return normalized.startsWith('3.');
}

/**
 * Extract path parameters from OpenAPI path string
 */
export function extractPathParameters(path: string): string[] {
  const matches = path.match(/\{([^}]+)\}/g);
  return matches ? matches.map(match => match.slice(1, -1)) : [];
}

/**
 * Generate tool name from operation
 */
export function generateToolName(
  method: string,
  path: string,
  operationId?: string
): string {
  if (operationId) {
    return operationId.replace(/[^a-zA-Z0-9_]/g, '_');
  }
  
  const pathSegments = path.split('/').filter(segment => segment && !segment.startsWith('{'));
  const cleanPath = pathSegments.join('_').replace(/[^a-zA-Z0-9_]/g, '_');
  
  return `${method}_${cleanPath}`.toLowerCase().replace(/^_+|_+$/g, '');
}

/**
 * Get action verb from HTTP method
 */
export function getActionFromMethod(method: string): string {
  const actions: Record<string, string> = {
    get: 'Retrieve',
    post: 'Create',
    put: 'Update',
    patch: 'Partially update',
    delete: 'Delete',
    head: 'Get headers for',
    options: 'Get options for',
    trace: 'Trace'
  };
  return actions[method.toLowerCase()] || 'Execute';
}

/**
 * Get resource name from path
 */
export function getResourceFromPath(path: string): string {
  const segments = path.split('/').filter(segment => 
    segment && !segment.startsWith('{') && segment !== 'api'
  );
  return segments.length > 0 ? segments.join(' ') : 'resource';
}

/**
 * Validate URL format
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Sanitize string for use as identifier
 */
export function sanitizeIdentifier(str: string): string {
  return str.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^_+|_+$/g, '');
}

/**
 * Format duration in human readable format
 */
export function formatDuration(milliseconds: number): string {
  if (milliseconds < 1000) {
    return `${milliseconds}ms`;
  }
  
  const seconds = milliseconds / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }
  
  const minutes = seconds / 60;
  return `${minutes.toFixed(1)}m`;
}

/**
 * Parse content type to determine format
 */
export function parseContentType(contentType: string): 'json' | 'yaml' | 'unknown' {
  const lower = contentType.toLowerCase();
  
  if (lower.includes('json')) {
    return 'json';
  }
  
  if (lower.includes('yaml') || lower.includes('yml')) {
    return 'yaml';
  }
  
  return 'unknown';
}
