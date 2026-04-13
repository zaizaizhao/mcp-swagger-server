import { Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '../../../config/app-config.service';
import {
  EndpointExtractor,
  OpenAPISpec,
  ParseResult,
  ValidationResult,
  parseAndTransform as parserParseAndTransform,
  parseFromFile as parserParseFromFile,
  parseFromString as parserParseFromString,
  parseFromUrl as parserParseFromUrl,
  validate as parserValidate,
} from 'mcp-swagger-parser';
import { transformOpenApiToMcpTools } from 'mcp-swagger-server';

interface ParserOptions {
  strictMode?: boolean;
  resolveReferences?: boolean;
  validateSchema?: boolean;
  baseUrl?: string;
}

@Injectable()
export class ParserService {
  private readonly logger = new Logger(ParserService.name);

  constructor(private readonly configService: AppConfigService) {}

  async parseFromUrl(url: string, options: ParserOptions = {}): Promise<ParseResult> {
    try {
      this.logger.log(`Parsing OpenAPI spec from URL: ${url}`);
      const result = await parserParseFromUrl(url, options);
      this.logger.log(`Successfully parsed OpenAPI spec from URL: ${url}`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to parse OpenAPI spec from URL: ${url}`, error);
      throw new Error(`Parse failed: ${error.message}`);
    }
  }

  async parseFromFile(filePath: string, options: ParserOptions = {}): Promise<ParseResult> {
    try {
      this.logger.log(`Parsing OpenAPI spec from file: ${filePath}`);
      const result = await parserParseFromFile(filePath, options);
      this.logger.log(`Successfully parsed OpenAPI spec from file: ${filePath}`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to parse OpenAPI spec from file: ${filePath}`, error);
      throw new Error(`Parse failed: ${error.message}`);
    }
  }

  async parseFromString(content: string, options: ParserOptions = {}): Promise<ParseResult> {
    try {
      this.logger.log('Parsing OpenAPI spec from string content');
      const result = await parserParseFromString(content, options);
      this.logger.log('Successfully parsed OpenAPI spec from string content');
      return result;
    } catch (error) {
      this.logger.error('Failed to parse OpenAPI spec from string', error);
      throw new Error(`Parse failed: ${error.message}`);
    }
  }

  async validateSpec(spec: any): Promise<ValidationResult> {
    try {
      this.logger.log('Validating OpenAPI specification');
      const result = await parserValidate(spec);
      this.logger.log(
        `Validation completed: ${result.valid ? 'valid' : 'invalid'} (${result.errors.length} errors, ${result.warnings.length} warnings)`,
      );
      return result;
    } catch (error) {
      this.logger.error('Failed to validate OpenAPI spec', error);
      throw new Error(`Validation failed: ${error.message}`);
    }
  }

  async parseAndTransform(
    input: string,
    inputType: 'url' | 'file' | 'content',
    options?: ParserOptions,
  ): Promise<any> {
    try {
      this.logger.log(`Parsing and transforming OpenAPI spec from ${inputType}`);
      const result = await parserParseAndTransform(input, {
        isString: inputType === 'content',
        isUrl: inputType === 'url',
        parserConfig: options,
      });
      this.logger.log(`Successfully parsed and transformed OpenAPI spec from ${inputType}`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to parse and transform OpenAPI spec from ${inputType}`, error);
      throw new Error(`Parse and transform failed: ${error.message}`);
    }
  }

  extractApiInfo(spec: any): any {
    return {
      title: spec.info?.title || 'Unknown API',
      version: spec.info?.version || '1.0.0',
      description: spec.info?.description,
      termsOfService: spec.info?.termsOfService,
      contact: spec.info?.contact,
      license: spec.info?.license,
      servers: spec.servers,
      externalDocs: spec.externalDocs,
    };
  }

  extractEndpoints(spec: any) {
    return EndpointExtractor.extractEndpoints(spec);
  }

  async parseSpecification(spec: any, options?: ParserOptions): Promise<any> {
    try {
      this.logger.log('Parsing OpenAPI specification');
      const normalized = await this.normalizeSpecification(spec, options);
      const info = this.extractApiInfo(normalized);
      const endpoints = this.extractEndpoints(normalized);

      return {
        ...normalized,
        info,
        paths: normalized.paths || {},
        endpoints,
        servers: normalized.servers || [],
        components: normalized.components || {},
        openapi: normalized.openapi || normalized.swagger || '3.0.0',
      };
    } catch (error) {
      this.logger.error(`Failed to parse specification: ${error.message}`, error.stack);
      throw error;
    }
  }

  async generateMCPTools(parsedSpec: any, options?: ParserOptions): Promise<any[]> {
    try {
      this.logger.log('Generating MCP tools from shared server transformer');
      const tools = await transformOpenApiToMcpTools(
        undefined,
        options?.baseUrl,
        parsedSpec,
      );
      this.logger.log(`Generated ${tools.length} MCP tools`);
      return tools.map((tool: any) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        metadata: tool.metadata,
      }));
    } catch (error) {
      this.logger.error(`Failed to generate MCP tools: ${error.message}`, error.stack);
      throw error;
    }
  }

  async normalizeSpecification(spec: any, options: ParserOptions = {}): Promise<any> {
    try {
      this.logger.log('Normalizing OpenAPI specification with shared parser');

      if (!spec || typeof spec !== 'object') {
        throw new Error('Invalid specification: must be an object');
      }

      // Keep compatibility defaults, then delegate conversion/normalization to shared parser.
      const specWithDefaults = this.applyCompatibilityDefaults(spec);
      const parseResult = await parserParseFromString(
        JSON.stringify(specWithDefaults),
        options,
      );
      const normalized = parseResult.spec;

      this.logger.log('Successfully normalized OpenAPI specification');
      return normalized;
    } catch (error) {
      this.logger.error(`Failed to normalize specification: ${error.message}`, error.stack);
      throw error;
    }
  }

  private applyCompatibilityDefaults(spec: any): OpenAPISpec {
    const normalized = JSON.parse(JSON.stringify(spec));

    if (!normalized.info) {
      normalized.info = {
        title: 'Untitled API',
        version: '1.0.0',
      };
    }

    if (!normalized.paths) {
      normalized.paths = {};
    }

    if (!normalized.openapi && !normalized.swagger) {
      normalized.openapi = '3.0.0';
    }

    return normalized;
  }
}
