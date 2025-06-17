/**
 * Core OpenAPI parser
 */

import type { 
  OpenAPISpec, 
  ParsedApiSpec, 
  ParseResult,
  ParserConfig, 
  ValidationResult 
} from '../types/index.js';
import { 
  OpenAPIParseError, 
  OpenAPIValidationError, 
  ERROR_CODES 
} from '../errors/index.js';
import { UrlParser } from '../parsers/url-parser.js';
import { FileParser } from '../parsers/file-parser.js';
import { TextParser } from '../parsers/text-parser.js';
import { Validator } from './validator.js';
import { Normalizer } from './normalizer.js';

/**
 * Default parser configuration
 */
const DEFAULT_CONFIG: Required<ParserConfig> = {
  validateSchema: true,
  resolveReferences: true,
  allowEmptyPaths: false,
  strictMode: false,
  customValidators: []
};

/**
 * Main OpenAPI parser class
 */
export class OpenAPIParser {
  private config: Required<ParserConfig>;
  private urlParser: UrlParser;
  private fileParser: FileParser;
  private textParser: TextParser;
  private validator: Validator;
  private normalizer: Normalizer;

  constructor(config: ParserConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Initialize sub-parsers
    this.urlParser = new UrlParser();
    this.fileParser = new FileParser();
    this.textParser = new TextParser();
    this.validator = new Validator(this.config);
    this.normalizer = new Normalizer(this.config);
  }

  /**
   * Parse OpenAPI specification from a URL
   */
  async parseFromUrl(url: string, options?: { timeout?: number; headers?: Record<string, string> }): Promise<ParseResult> {
    try {
      const startTime = Date.now();
      
      // Parse spec from URL
      const spec = await this.urlParser.parse(url, options);
      
      // Process the parsed spec
      return await this.processSpec(spec, {
        sourceType: 'url',
        sourceLocation: url,
        parsedAt: new Date(),
        parsingDuration: Date.now() - startTime
      });
    } catch (error) {
      throw this.handleError(error, 'parseFromUrl', { url });
    }
  }

  /**
   * Parse OpenAPI specification from a file
   */
  async parseFromFile(filePath: string, options?: { encoding?: BufferEncoding }): Promise<ParseResult> {
    try {
      const startTime = Date.now();
      
      // Parse spec from file
      const spec = await this.fileParser.parse(filePath, options);
      
      // Process the parsed spec
      return await this.processSpec(spec, {
        sourceType: 'file',
        sourceLocation: filePath,
        parsedAt: new Date(),
        parsingDuration: Date.now() - startTime
      });
    } catch (error) {
      throw this.handleError(error, 'parseFromFile', { filePath });
    }
  }

  /**
   * Parse OpenAPI specification from text content
   */
  async parseFromString(content: string, options?: { format?: 'json' | 'yaml' | 'auto'; filename?: string }): Promise<ParseResult> {
    try {
      const startTime = Date.now();
      const sourceInfo = options?.filename || 'string';
      
      // Parse spec from text
      const spec = await this.textParser.parse(content, options);
      
      // Process the parsed spec
      return await this.processSpec(spec, {
        sourceType: 'text',
        sourceLocation: sourceInfo,
        parsedAt: new Date(),
        parsingDuration: Date.now() - startTime
      });
    } catch (error) {
      throw this.handleError(error, 'parseFromString', { content: content.substring(0, 100) + '...' });
    }
  }

  /**
   * Validate an OpenAPI specification
   */
  async validate(spec: OpenAPISpec): Promise<ValidationResult> {
    return await this.validator.validate(spec);
  }

  /**
   * Process and validate the parsed specification
   */
  private async processSpec(
    spec: OpenAPISpec,
    metadata: Partial<ParseResult['metadata']>
  ): Promise<ParseResult> {
    // Normalize the specification
    if (this.config.resolveReferences) {
      spec = await this.normalizer.normalize(spec);
    }

    // Validate the specification
    const validation = await this.validate(spec);

    if (!validation.valid && this.config.strictMode) {
      throw new OpenAPIValidationError(
        'Specification validation failed',
        validation.errors,
        validation.warnings
      );
    }

    // Generate complete metadata
    const completeMetadata = this.generateMetadata(spec, metadata);

    // Create parsed spec
    const parsedSpec: ParsedApiSpec = {
      ...spec,
      metadata: completeMetadata
    };

    return {
      spec: parsedSpec,
      validation,
      metadata: completeMetadata
    };
  }

  /**
   * Generate metadata for the parsed specification
   */
  private generateMetadata(
    spec: OpenAPISpec,
    partial: Partial<ParseResult['metadata']>
  ): ParseResult['metadata'] {
    const pathCount = spec.paths ? Object.keys(spec.paths).length : 0;
    
    let operationCount = 0;
    if (spec.paths) {
      for (const pathItem of Object.values(spec.paths)) {
        const methods = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options', 'trace'] as const;
        operationCount += methods.filter(method => pathItem[method]).length;
      }
    }

    const schemaCount = spec.components?.schemas ? Object.keys(spec.components.schemas).length : 0;
    const securitySchemeCount = spec.components?.securitySchemes ? Object.keys(spec.components.securitySchemes).length : 0;

    return {
      sourceType: partial.sourceType || 'text',
      sourceLocation: partial.sourceLocation || 'unknown',
      parsedAt: partial.parsedAt || new Date(),
      parsingDuration: partial.parsingDuration || 0,
      endpointCount: operationCount,
      pathCount,
      schemaCount,
      securitySchemeCount,
      openApiVersion: spec.openapi,
      parserVersion: '1.0.0' // TODO: Get from package.json
    };
  }

  /**
   * Handle and transform errors
   */
  private handleError(error: any, method: string, context: any): Error {
    if (error instanceof OpenAPIParseError || error instanceof OpenAPIValidationError) {
      return error;
    }

    const message = error instanceof Error ? error.message : String(error);
    return new OpenAPIParseError(
      `Failed in ${method}: ${message}`,
      ERROR_CODES.PARSE_ERROR,
      undefined,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Convenience functions for quick parsing
 */

export async function parseFromUrl(url: string, config?: ParserConfig): Promise<ParseResult> {
  const parser = new OpenAPIParser(config);
  return parser.parseFromUrl(url);
}

export async function parseFromFile(filePath: string, config?: ParserConfig): Promise<ParseResult> {
  const parser = new OpenAPIParser(config);
  return parser.parseFromFile(filePath);
}

export async function parseFromString(content: string, config?: ParserConfig): Promise<ParseResult> {
  const parser = new OpenAPIParser(config);
  return parser.parseFromString(content);
}

export async function validate(spec: OpenAPISpec, config?: ParserConfig): Promise<ValidationResult> {
  const parser = new OpenAPIParser(config);
  return parser.validate(spec);
}
