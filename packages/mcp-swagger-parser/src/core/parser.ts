/**
 * Core OpenAPI parser
 */

import type { 
  OpenAPISpec, 
  ParsedApiSpec, 
  ParseResult,
  ParserConfig, 
  ValidationResult,
  Swagger2ConversionOptions
} from '../types/index';
import { 
  OpenAPIParseError, 
  OpenAPIValidationError, 
  Swagger2OpenAPIConversionError,
  UnsupportedVersionError,
  ERROR_CODES 
} from '../errors/index';
import { UrlParser } from '../parsers/url-parser';
import { FileParser } from '../parsers/file-parser';
import { TextParser } from '../parsers/text-parser';
import { Validator } from './validator';
import { Normalizer } from './normalizer';
import { VersionDetector } from './version-detector';
import { Swagger2OpenAPIConverter } from './swagger2openapi-converter';

/**
 * Default parser configuration
 */
const DEFAULT_CONFIG: Required<ParserConfig> = {
  validateSchema: true,
  resolveReferences: true,
  allowEmptyPaths: false,
  strictMode: false,
  customValidators: [],
  autoConvert: true,
  autoFix: true,
  swagger2Options: {
    patch: true,
    warnOnly: false,
    resolveInternal: false,
    targetVersion: '3.0.0',
    preserveRefs: true,
    warnProperty: 'x-s2o-warning',
    debug: false
  }
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
  private swagger2Converter: Swagger2OpenAPIConverter;

  constructor(config: ParserConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Initialize sub-parsers
    this.urlParser = new UrlParser();
    this.fileParser = new FileParser();
    this.textParser = new TextParser();
    this.validator = new Validator(this.config);
    this.normalizer = new Normalizer(this.config);
    
    // Initialize Swagger 2.0 converter
    this.swagger2Converter = new Swagger2OpenAPIConverter({
      patch: this.config.swagger2Options.patch,
      warnOnly: this.config.swagger2Options.warnOnly,
      resolveInternal: this.config.swagger2Options.resolveInternal,
      targetVersion: this.config.swagger2Options.targetVersion,
      preserveRefs: this.config.swagger2Options.preserveRefs,
      warnProperty: this.config.swagger2Options.warnProperty,
      debug: this.config.swagger2Options.debug
    });
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
    spec: any,
    metadata: Partial<ParseResult['metadata']>
  ): Promise<ParseResult> {
    let processedSpec: OpenAPISpec = spec;
    let conversionResult: any = null;
    
    // Detect API specification version
    if (this.config.autoConvert) {
      const version = VersionDetector.detect(spec);
      
      if (version === 'swagger2') {
        console.log('检测到 Swagger 2.0 规范，正在转换为 OpenAPI 3.0...');
        try {
          conversionResult = await this.swagger2Converter.convert(spec);
          processedSpec = conversionResult.openapi;
          
          // Update metadata with conversion info
          metadata.conversionPerformed = true;
          metadata.originalVersion = conversionResult.originalVersion;
          metadata.targetVersion = conversionResult.targetVersion;
          metadata.conversionDuration = conversionResult.duration;
          metadata.patchesApplied = conversionResult.patches;
          metadata.conversionWarnings = conversionResult.warnings;
          
          console.log(`✓ 转换完成: ${metadata.originalVersion} -> ${metadata.targetVersion} (${metadata.conversionDuration}ms)`);
          
          if (conversionResult.patches && conversionResult.patches > 0) {
            console.log(`✓ 应用了 ${conversionResult.patches} 个补丁修复`);
          }
          
          if (conversionResult.warnings && conversionResult.warnings.length > 0) {
            console.log(`⚠ 转换过程中产生了 ${conversionResult.warnings.length} 个警告`);
          }
          
        } catch (error) {
          if (error instanceof Swagger2OpenAPIConversionError || error instanceof UnsupportedVersionError) {
            throw error;
          }
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          throw new Swagger2OpenAPIConversionError(
            `Failed to convert Swagger 2.0 specification: ${errorMessage}`,
            error instanceof Error ? error : new Error(String(error))
          );
        }
      } else if (version === 'unknown') {
        throw new UnsupportedVersionError(
          spec.swagger || spec.openapi || 'unknown'
        );
      }
      // If version is 'openapi3', no conversion needed
    }

    // Normalize the specification
    if (this.config.resolveReferences) {
      processedSpec = await this.normalizer.normalize(processedSpec);
    }

    // Validate the specification
    const validation = await this.validate(processedSpec);

    if (!validation.valid && this.config.strictMode) {
      throw new OpenAPIValidationError(
        'Specification validation failed',
        validation.errors,
        validation.warnings
      );
    }

    // Generate complete metadata
    const completeMetadata = this.generateMetadata(processedSpec, metadata);

    // Create parsed spec
    const parsedSpec: ParsedApiSpec = {
      ...processedSpec,
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
      parserVersion: '1.0.0', // TODO: Get from package.json
      // Enhanced metadata
      conversionPerformed: partial.conversionPerformed || false,
      originalVersion: partial.originalVersion,
      targetVersion: partial.targetVersion,
      conversionDuration: partial.conversionDuration,
      patchesApplied: partial.patchesApplied,
      conversionWarnings: partial.conversionWarnings
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
