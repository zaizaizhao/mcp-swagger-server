/**
 * Output types for the parser
 */

import type { 
  OpenAPISpec, 
  ParameterObject,
  RequestBodyObject, 
  ResponsesObject,
  SecurityRequirementObject,
  SchemaObject
} from './openapi';

import type { ValidationResult } from './validation';

export interface ParsedApiSpec extends OpenAPISpec {
  metadata: ParseMetadata;
}

export interface ParseMetadata {
  sourceType: 'url' | 'file' | 'text';
  sourceLocation: string;
  parsedAt: Date;
  parsingDuration: number;
  endpointCount: number;
  pathCount: number;
  schemaCount: number;
  securitySchemeCount: number;
  openApiVersion: string;
  parserVersion: string;
}

export interface ApiEndpoint {
  path: string;
  method: HttpMethod;
  operationId?: string;
  summary?: string;
  description?: string;
  parameters: ParameterObject[];
  requestBody?: RequestBodyObject;
  responses: ResponsesObject;
  tags?: string[];
  deprecated?: boolean;
  security?: SecurityRequirementObject[];
}

export interface ParseResult {
  spec: ParsedApiSpec;
  validation: ValidationResult;
  metadata: ParseMetadata;
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS' | 'TRACE';
