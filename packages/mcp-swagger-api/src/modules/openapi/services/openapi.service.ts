import { Injectable, Logger, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfigService } from '../../../config/app-config.service';
import { ParserService } from './parser.service';
import { ValidatorService } from './validator.service';
import { ConfigureOpenAPIDto } from '../dto/configure-openapi.dto';
import { OpenAPIResponseDto } from '../dto/openapi-response.dto';

@Injectable()
export class OpenAPIService {
  private readonly logger = new Logger(OpenAPIService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly appConfigService: AppConfigService,
    private readonly parserService: ParserService,
    private readonly validatorService: ValidatorService,
  ) {}

  async parseOpenAPI(configDto: ConfigureOpenAPIDto): Promise<OpenAPIResponseDto> {
    try {
      this.logger.log(`Starting OpenAPI parsing for source type: ${configDto.source.type}`);

      // 1. Load OpenAPI specification
      const spec = await this.loadOpenAPISpec(configDto);

      // 2. Validate the specification
      const validationResult = await this.validatorService.validateSpecification(spec);
      if (!validationResult.valid) {
        throw new BadRequestException(`Invalid OpenAPI specification: ${validationResult.errors.join(', ')}`);
      }

      // 3. Parse the specification
      const parsedSpec = await this.parserService.parseSpecification(spec, configDto.options);

      // 4. Generate MCP tools from parsed specification
      const tools = await this.parserService.generateMCPTools(parsedSpec, configDto.options);

      // 5. Build response
      const response: OpenAPIResponseDto = {
        info: {
          title: parsedSpec.info?.title || 'Untitled API',
          version: parsedSpec.info?.version || '1.0.0',
          description: parsedSpec.info?.description,
          termsOfService: parsedSpec.info?.termsOfService,
          contact: parsedSpec.info?.contact,
          license: parsedSpec.info?.license,
        },
        paths: parsedSpec.paths || [],
        tools: tools || [],
        servers: parsedSpec.servers || [],
        openapi: parsedSpec.openapi || parsedSpec.swagger || '3.0.0',
        components: parsedSpec.components || {},
        parsedAt: new Date().toISOString(),
        parseId: this.generateParseId(),
      };

      this.logger.log(`Successfully parsed OpenAPI specification with ${response.paths.length} paths and ${response.tools.length} tools`);

      return response;
    } catch (error) {
      this.logger.error(`Failed to parse OpenAPI specification: ${error.message}`, error.stack);
      
      if (error instanceof BadRequestException) {
        throw error;
      }
      
      throw new InternalServerErrorException(`OpenAPI parsing failed: ${error.message}`);
    }
  }

  async validateOpenAPI(configDto: ConfigureOpenAPIDto): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    try {
      this.logger.log(`Starting OpenAPI validation for source type: ${configDto.source.type}`);

      // Load OpenAPI specification
      const spec = await this.loadOpenAPISpec(configDto);

      // Validate the specification
      const result = await this.validatorService.validateSpecification(spec);

      this.logger.log(`OpenAPI validation completed: ${result.valid ? 'valid' : 'invalid'} with ${result.errors.length} errors and ${result.warnings.length} warnings`);

      return result;
    } catch (error) {
      this.logger.error(`Failed to validate OpenAPI specification: ${error.message}`, error.stack);
      
      return {
        valid: false,
        errors: [error.message],
        warnings: [],
      };
    }
  }

  async normalizeOpenAPI(configDto: ConfigureOpenAPIDto): Promise<{
    normalized: any;
    format: string;
    version: string;
  }> {
    try {
      this.logger.log(`Starting OpenAPI normalization for source type: ${configDto.source.type}`);

      // Load OpenAPI specification
      const spec = await this.loadOpenAPISpec(configDto);

      // Normalize the specification
      const normalized = await this.parserService.normalizeSpecification(spec);

      const format = normalized.openapi ? 'openapi' : 'swagger';
      const version = normalized.openapi || normalized.swagger || '3.0.0';

      this.logger.log(`Successfully normalized OpenAPI specification to ${format} ${version}`);

      return {
        normalized,
        format,
        version,
      };
    } catch (error) {
      this.logger.error(`Failed to normalize OpenAPI specification: ${error.message}`, error.stack);
      throw new BadRequestException(`OpenAPI normalization failed: ${error.message}`);
    }
  }

  private async loadOpenAPISpec(configDto: ConfigureOpenAPIDto): Promise<any> {
    const { source } = configDto;

    switch (source.type) {
      case 'url':
        return this.loadFromUrl(source.content);
      
      case 'file':
        return this.loadFromFile(source.content);
      
      case 'content':
        return this.loadFromContent(source.content);
      
      default:
        throw new BadRequestException(`Unsupported source type: ${source.type}`);
    }
  }

  private async loadFromUrl(url: string): Promise<any> {
    try {
      this.logger.log(`Loading OpenAPI specification from URL: ${url}`);
      
      // Create abort controller for timeout
      const timeoutMs = this.appConfigService.get('REQUEST_TIMEOUT') || 30000;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json,application/yaml,text/yaml,text/plain',
          'User-Agent': 'MCP-Swagger-API/1.0.0',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');
      const text = await response.text();

      // Check if the response is empty or null
      if (!text || text.trim() === '' || text.trim() === 'null') {
        throw new Error('Empty or null response from URL');
      }

      if (contentType?.includes('application/json')) {
        try {
          return JSON.parse(text);
        } catch (error) {
          throw new Error(`Invalid JSON response: ${error.message}`);
        }
      } else if (contentType?.includes('yaml') || contentType?.includes('yml')) {
        // Parse YAML (we'll need to add yaml parsing support)
        return this.parseYaml(text);
      } else {
        // Try to parse as JSON first, then YAML
        try {
          return JSON.parse(text);
        } catch (jsonError) {
          try {
            return this.parseYaml(text);
          } catch (yamlError) {
            throw new Error(`Failed to parse response as JSON or YAML. JSON error: ${jsonError.message}, YAML error: ${yamlError.message}`);
          }
        }
      }
    } catch (error) {
      this.logger.error(`Failed to load OpenAPI specification from URL: ${error.message}`);
      if (error.name === 'AbortError') {
        throw new BadRequestException(`Request timeout: Failed to load from URL within ${this.appConfigService.get('REQUEST_TIMEOUT') || 30000}ms`);
      }
      throw new BadRequestException(`Failed to load from URL: ${error.message}`);
    }
  }

  private async loadFromFile(filePath: string): Promise<any> {
    try {
      this.logger.log(`Loading OpenAPI specification from file: ${filePath}`);
      
      // For security, we'll need to implement file access restrictions
      // For now, we'll throw an error as file access should be handled carefully
      throw new BadRequestException('File loading not yet implemented for security reasons');
    } catch (error) {
      this.logger.error(`Failed to load OpenAPI specification from file: ${error.message}`);
      throw new BadRequestException(`Failed to load from file: ${error.message}`);
    }
  }

  private async loadFromContent(content: string): Promise<any> {
    try {
      this.logger.log(`Loading OpenAPI specification from content`);
      
      // Try to parse as JSON first
      try {
        return JSON.parse(content);
      } catch {
        // Try to parse as YAML
        return this.parseYaml(content);
      }
    } catch (error) {
      this.logger.error(`Failed to load OpenAPI specification from content: ${error.message}`);
      throw new BadRequestException(`Failed to parse content: ${error.message}`);
    }
  }

  private parseYaml(yamlContent: string): any {
    // TODO: Implement YAML parsing
    // For now, we'll throw an error
    throw new BadRequestException('YAML parsing not yet implemented');
  }

  private generateParseId(): string {
    return `parse_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
