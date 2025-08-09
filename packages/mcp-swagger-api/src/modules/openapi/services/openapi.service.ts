import { Injectable, Logger, BadRequestException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppConfigService } from '../../../config/app-config.service';
import { ParserService } from './parser.service';
import { ValidatorService } from './validator.service';
import { ConfigureOpenAPIDto } from '../dto/configure-openapi.dto';
import { OpenAPIResponseDto } from '../dto/openapi-response.dto';
import { MCPServerEntity } from '../../../database/entities/mcp-server.entity';
import { UrlParser, FileParser, TextParser } from 'mcp-swagger-parser';
import { log } from 'util';

@Injectable()
export class OpenAPIService {
  private readonly logger = new Logger(OpenAPIService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly appConfigService: AppConfigService,
    private readonly parserService: ParserService,
    private readonly validatorService: ValidatorService,
    @InjectRepository(MCPServerEntity)
    private readonly serverRepository: Repository<MCPServerEntity>,
  ) { }

  async parseOpenAPI(configDto: ConfigureOpenAPIDto): Promise<OpenAPIResponseDto> {
    try {
      this.logger.log(`Starting OpenAPI parsing for source type: ${configDto.source.type}`);

      // 1. Load raw OpenAPI specification (without parsing)
      const spec = await this.loadOpenAPISpec(configDto);
      // 3. Parse the validated specification
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
        paths: parsedSpec.paths || {},
        endpoints: parsedSpec.endpoints || [],
        tools: tools || [],
        servers: parsedSpec.servers || [],
        openapi: parsedSpec.openapi || parsedSpec.swagger || '3.0.0',
        components: parsedSpec.components || {},
        parsedAt: new Date().toISOString(),
        parseId: this.generateParseId(),
      };

      this.logger.log(`Successfully parsed OpenAPI specification with ${response.endpoints.length} endpoints and ${response.tools.length} tools`);

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

      // Check if content is empty
      if (configDto.source.content == "") {
        throw new Error("验证文档不能为空")
      } else {
        try {
          const content = JSON.parse(configDto.source.content)
          // 传入的就是原始的编辑器中的openapi规范
          //const spec = await this.loadOpenAPISpec(configDto);
          console.log("Loaded spec for validation:", content);

          // Validate the parsed specification
          const result = await this.validatorService.validateSpecification(content);

          this.logger.log(`OpenAPI validation completed: ${result.valid ? 'valid' : 'invalid'} with ${result.errors.length} errors and ${result.warnings.length} warnings`);

          return result;
        } catch (e) {

        }
      }
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

      // Use ParserService to parse from URL directly
      const result = await this.parserService.parseFromUrl(url);

      return result.spec;
    } catch (error) {
      this.logger.error(`Failed to load OpenAPI specification from URL: ${error.message}`);
      throw new BadRequestException(`Failed to load from URL: ${error.message}`);
    }
  }

  private async loadFromFile(filePath: string): Promise<any> {
    try {
      this.logger.log(`Loading OpenAPI specification from file: ${filePath}`);

      // Use ParserService to parse from file directly
      const parseResult = await this.parserService.parseFromFile(filePath);

      return parseResult.spec;
    } catch (error) {
      this.logger.error(`Failed to load OpenAPI specification from file: ${error.message}`);
      throw new BadRequestException(`Failed to load from file: ${error.message}`);
    }
  }

  private async loadFromContent(content: string): Promise<any> {
    try {
      this.logger.log(`Loading OpenAPI specification from content`);

      // Use ParserService to parse from string directly
      const parseResult = await this.parserService.parseFromString(content);

      return parseResult.spec;
    } catch (error) {
      this.logger.error(`Failed to load OpenAPI specification from content: ${error.message}`);
      throw new BadRequestException(`Failed to parse content: ${error.message}`);
    }
  }

  async getOpenApiByServerId(serverId: string): Promise<any> {
    try {
      this.logger.log(`Retrieving OpenAPI document for server ID: ${serverId}`);

      // 从数据库中查询服务器实体
      const server = await this.serverRepository.findOne({
        where: { id: serverId },
        select: ['id', 'name', 'openApiData']
      });

      if (!server) {
        throw new NotFoundException(`Server with ID ${serverId} not found`);
      }

      if (!server.openApiData) {
        throw new NotFoundException(`No OpenAPI document found for server ${serverId}`);
      }

      this.logger.log(`Successfully retrieved OpenAPI document for server: ${server.name}`);

      // 直接返回 openApiData，它已经是 JSON 格式
      return server.openApiData;
    } catch (error) {
      this.logger.error(`Failed to retrieve OpenAPI document for server ID ${serverId}: ${error.message}`, error.stack);
      
      if (error instanceof NotFoundException) {
        throw error;
      }
      
      throw new InternalServerErrorException(`Failed to retrieve OpenAPI document: ${error.message}`);
    }
  }

  private generateParseId(): string {
    return `parse_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
