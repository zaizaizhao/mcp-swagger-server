/**
 * Type definitions for MCP Swagger Parser
 */

// Validation types (exported first to avoid conflicts)
export type { ValidationError, ValidationWarning, ValidationResult } from './validation';

// OpenAPI specification types
export * from './openapi';

// Input types
export * from './input';

// Output types (excluding conflicting validation types)
export type { 
  ParsedApiSpec, 
  ParseMetadata, 
  ApiEndpoint, 
  ParseResult, 
  HttpMethod 
} from './output';

// Configuration types
export * from './config';
export type { OperationFilter } from '../transformer/types';
