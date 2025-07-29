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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiBearerAuth,
  ApiSecurity,
} from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { JwtAuthGuard } from '../security/guards/jwt-auth.guard';
import { LoggingInterceptor } from '../../common/interceptors/logging.interceptor';
import { OpenAPIService } from './services/openapi.service';
import { ConfigureOpenAPIDto } from './dto/configure-openapi.dto';
import { OpenAPIResponseDto } from './dto/openapi-response.dto';

@ApiTags('OpenAPI')
@Controller('openapi')
@UseGuards(JwtAuthGuard)
@UseInterceptors(LoggingInterceptor)
@ApiBearerAuth()
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
}
