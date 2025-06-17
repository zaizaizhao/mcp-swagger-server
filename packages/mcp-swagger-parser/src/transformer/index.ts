import { OpenAPISpec, OperationObject, ParameterObject, RequestBodyObject, SchemaObject, ReferenceObject } from '../types/index';
import { MCPTool, MCPToolResponse, TransformerOptions } from './types';

// Re-export types
export type { MCPTool, MCPToolResponse, TransformerOptions } from './types';

/**
 * OpenAPI to MCP Tools Transformer
 */
export class OpenAPIToMCPTransformer {
  private spec: OpenAPISpec;
  private options: Required<TransformerOptions>;

  constructor(spec: OpenAPISpec, options: TransformerOptions = {}) {
    this.spec = spec;
    this.options = {
      baseUrl: options.baseUrl || this.getDefaultBaseUrl(),
      includeDeprecated: options.includeDeprecated ?? false,
      includeTags: options.includeTags ?? [],
      excludeTags: options.excludeTags ?? [],
      requestTimeout: options.requestTimeout ?? 30000,
      defaultHeaders: options.defaultHeaders ?? { 'Content-Type': 'application/json' },
      customHandlers: options.customHandlers ?? {},
      pathPrefix: options.pathPrefix ?? '',
      stripBasePath: options.stripBasePath ?? false
    };
  }

  /**
   * Transform OpenAPI specification to MCP Tools
   */
  public transformToMCPTools(): MCPTool[] {
    const tools: MCPTool[] = [];

    for (const [path, pathItem] of Object.entries(this.spec.paths)) {
      const methods = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options', 'trace'] as const;
      
      for (const method of methods) {
        const operation = pathItem[method];
        if (operation && this.shouldIncludeOperation(operation)) {
          const tool = this.createMCPToolFromOperation(method, path, operation);
          if (tool) {
            tools.push(tool);
          }
        }
      }
    }

    return tools;
  }

  /**
   * Get default base URL from spec
   */
  private getDefaultBaseUrl(): string {
    if (this.spec.servers && this.spec.servers.length > 0) {
      return this.spec.servers[0].url;
    }
    return 'http://localhost';
  }

  /**
   * Check if operation should be included based on options
   */
  private shouldIncludeOperation(operation: OperationObject): boolean {
    // Skip deprecated operations if not included
    if (operation.deprecated && !this.options.includeDeprecated) {
      return false;
    }

    // Include/exclude by tags
    if (operation.tags) {
      // If includeTags is specified, only include operations with those tags
      if (this.options.includeTags.length > 0) {
        const hasIncludedTag = operation.tags.some(tag => this.options.includeTags.includes(tag));
        if (!hasIncludedTag) {
          return false;
        }
      }

      // Exclude operations with excluded tags
      if (this.options.excludeTags.length > 0) {
        const hasExcludedTag = operation.tags.some(tag => this.options.excludeTags.includes(tag));
        if (hasExcludedTag) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Create MCP Tool from OpenAPI Operation
   */
  private createMCPToolFromOperation(method: string, path: string, operation: OperationObject): MCPTool | null {
    try {
      const toolName = this.generateToolName(method, path, operation);
      const description = this.generateDescription(method, path, operation);
      const inputSchema = this.generateInputSchema(operation);
      const handler = this.createHandler(method, path, operation);

      return {
        name: toolName,
        description,
        inputSchema,
        handler,
        metadata: {
          method: method.toUpperCase(),
          path,
          tags: operation.tags,
          operationId: operation.operationId,
          deprecated: operation.deprecated
        }
      };
    } catch (error) {
      console.warn(`Failed to create tool for ${method.toUpperCase()} ${path}:`, error);
      return null;
    }
  }

  /**
   * Generate tool name from operation
   */
  private generateToolName(method: string, path: string, operation: OperationObject): string {
    // Use operationId if available
    if (operation.operationId) {
      return operation.operationId;
    }

    // Generate from method and path
    const cleanPath = path
      .replace(/[{}]/g, '') // Remove parameter braces
      .replace(/[^a-zA-Z0-9]/g, '_') // Replace non-alphanumeric with underscore
      .replace(/_+/g, '_') // Replace multiple underscores with single
      .replace(/^_|_$/g, ''); // Remove leading/trailing underscores

    return `${method}_${cleanPath}`;
  }

  /**
   * Generate description from operation
   */
  private generateDescription(method: string, path: string, operation: OperationObject): string {
    if (operation.description) {
      return operation.description;
    }

    if (operation.summary) {
      return operation.summary;
    }

    // Generate default description
    const methodUpper = method.toUpperCase();
    return `${methodUpper} request to ${path}`;
  }

  /**
   * Generate input schema from operation parameters and request body
   */
  private generateInputSchema(operation: OperationObject): MCPTool['inputSchema'] {
    const properties: Record<string, any> = {};
    const required: string[] = [];

    // Add parameters
    if (operation.parameters) {
      for (const param of operation.parameters) {
        if (!this.isReferenceObject(param)) {
          const paramSchema = this.convertSchemaToJsonSchema(param.schema || { type: 'string' });
          properties[param.name] = {
            ...paramSchema,
            description: param.description || `${param.in} parameter`
          };

          if (param.required) {
            required.push(param.name);
          }
        }
      }
    }

    // Add request body
    if (operation.requestBody && !this.isReferenceObject(operation.requestBody)) {
      const requestBody = operation.requestBody;
      if (requestBody.content) {
        // Prefer application/json
        const jsonContent = requestBody.content['application/json'];
        if (jsonContent && jsonContent.schema) {
          const bodySchema = this.convertSchemaToJsonSchema(jsonContent.schema);
          if (bodySchema.type === 'object' && bodySchema.properties) {
            // Merge request body properties
            Object.assign(properties, bodySchema.properties);
            if (bodySchema.required) {
              required.push(...bodySchema.required);
            }
          } else {
            properties.body = bodySchema;
            if (requestBody.required) {
              required.push('body');
            }
          }
        }
      }
    }

    return {
      type: 'object',
      properties,
      required: required.length > 0 ? required : undefined,
      additionalProperties: false
    };
  }

  /**
   * Create handler function for the operation
   */
  private createHandler(method: string, path: string, operation: OperationObject) {
    return async (args: any): Promise<MCPToolResponse> => {
      try {
        // Check for custom handler
        const customHandler = this.options.customHandlers[operation.operationId || `${method}_${path}`];
        if (customHandler) {
          return await customHandler(args);
        }

        // Default HTTP request handler
        return await this.executeHttpRequest(method, path, args, operation);
      } catch (error) {
        console.error(`Error executing ${method.toUpperCase()} ${path}:`, error);
        return {
          content: [{
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
          }],
          isError: true
        };
      }
    };
  }

  /**
   * Execute HTTP request
   */
  private async executeHttpRequest(
    method: string, 
    path: string, 
    args: any, 
    operation: OperationObject
  ): Promise<MCPToolResponse> {
    // This is a placeholder implementation
    // In a real implementation, you would use an HTTP client like axios
    const fullUrl = this.buildUrl(path, args);
    
    return {
      content: [{
        type: 'text',
        text: `Would execute ${method.toUpperCase()} request to ${fullUrl} with args: ${JSON.stringify(args, null, 2)}`
      }]
    };
  }

  /**
   * Build URL with path parameters
   */
  private buildUrl(path: string, args: any): string {
    let url = this.options.baseUrl + this.options.pathPrefix + path;
    
    // Replace path parameters
    url = url.replace(/{([^}]+)}/g, (match, paramName) => {
      return args[paramName] || match;
    });

    return url;
  }

  /**
   * Check if object is a reference
   */
  private isReferenceObject(obj: any): obj is ReferenceObject {
    return obj && typeof obj === 'object' && '$ref' in obj;
  }

  /**
   * Convert OpenAPI schema to JSON schema
   */
  private convertSchemaToJsonSchema(schema: SchemaObject | ReferenceObject): any {
    if (this.isReferenceObject(schema)) {
      // For simplicity, return a generic object for references
      // In a real implementation, you would resolve the reference
      return { type: 'object' };
    }

    // Basic schema conversion
    const jsonSchema: any = {};
    
    if (schema.type) {
      jsonSchema.type = schema.type;
    }
    
    if (schema.properties) {
      jsonSchema.properties = {};
      for (const [key, prop] of Object.entries(schema.properties)) {
        jsonSchema.properties[key] = this.convertSchemaToJsonSchema(prop);
      }
    }
    
    if (schema.items) {
      jsonSchema.items = this.convertSchemaToJsonSchema(schema.items);
    }
    
    if (schema.required) {
      jsonSchema.required = schema.required;
    }
    
    if (schema.description) {
      jsonSchema.description = schema.description;
    }
    
    if (schema.example !== undefined) {
      jsonSchema.examples = [schema.example];
    }

    return jsonSchema;
  }
}

/**
 * Convenience function to transform OpenAPI spec to MCP tools
 */
export function transformToMCPTools(
  spec: OpenAPISpec, 
  options: TransformerOptions = {}
): MCPTool[] {
  const transformer = new OpenAPIToMCPTransformer(spec, options);
  return transformer.transformToMCPTools();
}
