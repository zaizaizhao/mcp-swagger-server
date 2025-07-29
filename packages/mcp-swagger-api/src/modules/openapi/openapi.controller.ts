import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  UseInterceptors,
  Logger,
  BadRequestException,
  InternalServerErrorException,
  UploadedFile,
  Query,
  Get,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiBearerAuth,
  ApiSecurity,
  ApiConsumes,
  ApiQuery,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Express } from 'express';
import { ThrottlerGuard } from '@nestjs/throttler';
import { JwtAuthGuard } from '../security/guards/jwt-auth.guard';
import { LoggingInterceptor } from '../../common/interceptors/logging.interceptor';
import { OpenAPIService } from './services/openapi.service';
import { ConfigureOpenAPIDto, InputSourceType } from './dto/configure-openapi.dto';
import { OpenAPIResponseDto } from './dto/openapi-response.dto';

@ApiTags('OpenAPI')
@Controller('openapi')
// @UseGuards(JwtAuthGuard)
@UseInterceptors(LoggingInterceptor)
// @ApiBearerAuth()
export class OpenAPIController {
  private readonly logger = new Logger(OpenAPIController.name);

  constructor(private readonly openApiService: OpenAPIService) {}

  @Post('parse')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Parse OpenAPI/Swagger specification',
    description: 'Parse and validate OpenAPI/Swagger specification from URL or content',
  })
  @ApiBody({
    type: ConfigureOpenAPIDto,
    description: 'OpenAPI configuration parameters',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Successfully parsed OpenAPI specification',
    type: OpenAPIResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid request parameters or OpenAPI specification',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Invalid or missing JWT token',
  })
  @ApiResponse({
    status: HttpStatus.TOO_MANY_REQUESTS,
    description: 'Rate limit exceeded',
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Internal server error during parsing',
  })
  async parseOpenAPI(
    @Body() configureDto: ConfigureOpenAPIDto,
  ): Promise<OpenAPIResponseDto> {
    try {
      this.logger.log(`Parsing OpenAPI specification: ${JSON.stringify({
        sourceType: configureDto.source.type,
        hasContent: !!configureDto.source.content,
        options: configureDto.options ? Object.keys(configureDto.options) : [],
      })}`);

      const result = await this.openApiService.parseOpenAPI(configureDto);

      this.logger.log(`Successfully parsed OpenAPI specification with ${result.paths?.length || 0} endpoints`);

      return result;
    } catch (error) {
      this.logger.error(`Failed to parse OpenAPI specification: ${error.message}`, error.stack);
      
      if (error.name === 'ValidationError' || error.message.includes('Invalid')) {
        throw new BadRequestException(`OpenAPI parsing failed: ${error.message}`);
      }
      
      throw new InternalServerErrorException('Failed to parse OpenAPI specification');
    }
  }

  @Post('validate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Validate OpenAPI/Swagger specification',
    description: 'Validate OpenAPI/Swagger specification without full parsing',
  })
  @ApiBody({
    type: ConfigureOpenAPIDto,
    description: 'OpenAPI configuration parameters',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Validation result',
    schema: {
      type: 'object',
      properties: {
        valid: { type: 'boolean' },
        errors: {
          type: 'array',
          items: { type: 'string' },
        },
        warnings: {
          type: 'array',
          items: { type: 'string' },
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid request parameters',
  })
  async validateOpenAPI(@Body() configureDto: ConfigureOpenAPIDto) {
    try {
      this.logger.log(`Validating OpenAPI specification: ${JSON.stringify({
        sourceType: configureDto.source.type,
        hasContent: !!configureDto.source.content,
        options: configureDto.options ? Object.keys(configureDto.options) : [],
      })}`);

      const result = await this.openApiService.validateOpenAPI(configureDto);

      this.logger.log(`OpenAPI validation completed: ${result.valid ? 'valid' : 'invalid'}`);

      return result;
    } catch (error) {
      this.logger.error(`Failed to validate OpenAPI specification: ${error.message}`, error.stack);
      throw new BadRequestException(`OpenAPI validation failed: ${error.message}`);
    }
  }

  @Post('normalize')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Normalize OpenAPI/Swagger specification',
    description: 'Normalize and standardize OpenAPI/Swagger specification format',
  })
  @ApiBody({
    type: ConfigureOpenAPIDto,
    description: 'OpenAPI configuration parameters',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Normalized OpenAPI specification',
    schema: {
      type: 'object',
      properties: {
        normalized: { type: 'object' },
        format: { type: 'string', enum: ['openapi', 'swagger'] },
        version: { type: 'string' },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid request parameters or specification',
  })
  async normalizeOpenAPI(@Body() configureDto: ConfigureOpenAPIDto) {
    try {
      this.logger.log(`Normalizing OpenAPI specification: ${JSON.stringify({
        sourceType: configureDto.source.type,
        hasContent: !!configureDto.source.content,
        options: configureDto.options ? Object.keys(configureDto.options) : [],
      })}`);

      const result = await this.openApiService.normalizeOpenAPI(configureDto);

      this.logger.log(`Successfully normalized OpenAPI specification`);

      return result;
    } catch (error) {
      this.logger.error(`Failed to normalize OpenAPI specification: ${error.message}`, error.stack);
      throw new BadRequestException(`OpenAPI normalization failed: ${error.message}`);
    }
  }

  @Post('upload')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: 'Upload and parse OpenAPI/Swagger specification file',
    description: 'Upload a JSON or YAML file containing OpenAPI/Swagger specification',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'OpenAPI specification file (JSON or YAML)',
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Successfully parsed uploaded OpenAPI specification',
    type: OpenAPIResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid file or OpenAPI specification',
  })
  async uploadOpenAPI(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<OpenAPIResponseDto> {
    try {
      if (!file) {
        throw new BadRequestException('No file uploaded');
      }

      if (!file.buffer) {
        throw new BadRequestException('File content is empty');
      }

      // Check file size (limit to 10MB)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        throw new BadRequestException('File size exceeds 10MB limit');
      }

      // Check file type
      const allowedMimeTypes = ['application/json', 'text/yaml', 'application/yaml', 'text/plain'];
      if (!allowedMimeTypes.includes(file.mimetype)) {
        throw new BadRequestException('Invalid file type. Only JSON and YAML files are allowed.');
      }

      this.logger.log(`Processing uploaded file: ${file.originalname} (${file.size} bytes)`);

      const content = file.buffer.toString('utf-8');
      const configDto = {
        source: {
          type: InputSourceType.CONTENT,
          content: content,
        },
      };

      const result = await this.openApiService.parseOpenAPI(configDto);

      this.logger.log(`Successfully parsed uploaded OpenAPI specification with ${result.paths?.length || 0} endpoints`);

      return result;
    } catch (error) {
      this.logger.error(`Failed to process uploaded file: ${error.message}`, error.stack);
      
      if (error instanceof BadRequestException) {
        throw error;
      }
      
      throw new InternalServerErrorException('Failed to process uploaded file');
    }
  }

  @Post('validate-upload')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: 'Upload and validate OpenAPI/Swagger specification file',
    description: 'Upload a JSON or YAML file for validation only',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'OpenAPI specification file (JSON or YAML)',
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Validation result',
    schema: {
      type: 'object',
      properties: {
        valid: { type: 'boolean' },
        errors: {
          type: 'array',
          items: { type: 'string' },
        },
        warnings: {
          type: 'array',
          items: { type: 'string' },
        },
      },
    },
  })
  async validateUploadedFile(
    @UploadedFile() file: Express.Multer.File,
  ) {
    try {
      if (!file) {
        throw new BadRequestException('No file uploaded');
      }

      if (!file.buffer) {
        throw new BadRequestException('File content is empty');
      }

      // Check file size (limit to 10MB)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        throw new BadRequestException('File size exceeds 10MB limit');
      }

      this.logger.log(`Validating uploaded file: ${file.originalname} (${file.size} bytes)`);

      const content = file.buffer.toString('utf-8');
      const configDto = {
        source: {
          type: InputSourceType.CONTENT,
          content: content,
        },
      };

      const result = await this.openApiService.validateOpenAPI(configDto);

      this.logger.log(`OpenAPI validation completed: ${result.valid ? 'valid' : 'invalid'}`);

      return result;
    } catch (error) {
      this.logger.error(`Failed to validate uploaded file: ${error.message}`, error.stack);
      throw new BadRequestException(`File validation failed: ${error.message}`);
    }
  }

  @Get('validate-url')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Validate OpenAPI/Swagger specification from URL',
    description: 'Validate OpenAPI/Swagger specification by providing a URL',
  })
  @ApiQuery({
    name: 'url',
    description: 'URL to the OpenAPI specification',
    example: 'https://petstore.swagger.io/v2/swagger.json',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Validation result',
    schema: {
      type: 'object',
      properties: {
        valid: { type: 'boolean' },
        errors: {
          type: 'array',
          items: { type: 'string' },
        },
        warnings: {
          type: 'array',
          items: { type: 'string' },
        },
      },
    },
  })
  async validateFromUrl(@Query('url') url: string) {
    try {
      if (!url) {
        throw new BadRequestException('URL parameter is required');
      }

      this.logger.log(`Validating OpenAPI specification from URL: ${url}`);

      const configDto = {
        source: {
          type: InputSourceType.URL,
          content: url,
        },
      };

      const result = await this.openApiService.validateOpenAPI(configDto);

      this.logger.log(`OpenAPI validation completed: ${result.valid ? 'valid' : 'invalid'}`);

      return result;
    } catch (error) {
      this.logger.error(`Failed to validate OpenAPI from URL: ${error.message}`, error.stack);
      throw new BadRequestException(`URL validation failed: ${error.message}`);
    }
  }

  @Get('parse-url')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Parse OpenAPI/Swagger specification from URL',
    description: 'Parse OpenAPI/Swagger specification by providing a URL',
  })
  @ApiQuery({
    name: 'url',
    description: 'URL to the OpenAPI specification',
    example: 'https://petstore.swagger.io/v2/swagger.json',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Successfully parsed OpenAPI specification',
    type: OpenAPIResponseDto,
  })
  async parseFromUrl(@Query('url') url: string): Promise<OpenAPIResponseDto> {
    try {
      if (!url) {
        throw new BadRequestException('URL parameter is required');
      }
      console.log(url);
      
      this.logger.log(`Parsing OpenAPI specification from URL: ${url}`);

      const configDto = {
        source: {
          type: InputSourceType.URL,
          content: url,
        },
      };

      const result = await this.openApiService.parseOpenAPI(configDto);

      this.logger.log(`Successfully parsed OpenAPI specification with ${result.paths?.length || 0} endpoints`);

      return result;
    } catch (error) {
      this.logger.error(`Failed to parse OpenAPI from URL: ${error.message}`, error.stack);
      
      if (error instanceof BadRequestException) {
        throw error;
      }
      
      throw new InternalServerErrorException('Failed to parse OpenAPI from URL');
    }
  }
}
