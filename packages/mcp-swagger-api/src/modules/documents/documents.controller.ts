import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  UseInterceptors,
  Logger,
  HttpCode,
  HttpStatus,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../security/guards/jwt-auth.guard';

import { DocumentsService } from './services/documents.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { QueryDocumentDto } from './dto/query-document.dto';
import {
  DocumentResponseDto,
  DocumentDetailResponseDto,
  DocumentListResponseDto,
} from './dto/document-response.dto';

@ApiTags('Documents')
@Controller('documents')
@UseGuards(JwtAuthGuard)

@ApiBearerAuth()
export class DocumentsController {
  private readonly logger = new Logger(DocumentsController.name);

  constructor(private readonly documentsService: DocumentsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: '创建OpenAPI文档',
    description: '创建新的OpenAPI文档，文档内容将与当前用户关联',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: '文档创建成功',
    type: DocumentDetailResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: '请求参数无效或文档内容格式错误',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: '未授权访问',
  })
  async create(
    @Request() req: any,
    @Body() createDocumentDto: CreateDocumentDto,
  ): Promise<DocumentDetailResponseDto> {
    const userId = req.user.id;
    this.logger.log(`Creating document for user ${userId}`);
    
    return this.documentsService.create(userId, createDocumentDto);
  }

  @Get()
  @ApiOperation({
    summary: '获取用户文档列表',
    description: '获取当前用户的所有OpenAPI文档，支持分页、搜索和过滤',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '成功获取文档列表',
    type: DocumentListResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: '未授权访问',
  })
  async findAll(
    @Request() req: any,
    @Query() queryDto: QueryDocumentDto,
  ): Promise<DocumentListResponseDto> {
    const userId = req.user.id;
    this.logger.log(`Getting documents for user ${userId}`);
    
    return this.documentsService.findAll(userId, queryDto);
  }

  @Get(':id')
  @ApiOperation({
    summary: '获取单个文档详情',
    description: '根据文档ID获取完整的文档信息，包括OpenAPI规范内容',
  })
  @ApiParam({
    name: 'id',
    description: '文档ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '成功获取文档详情',
    type: DocumentDetailResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: '文档不存在',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: '未授权访问',
  })
  async findOne(
    @Request() req: any,
    @Param('id') id: string,
  ): Promise<DocumentDetailResponseDto> {
    const userId = req.user.id;
    this.logger.log(`Getting document ${id} for user ${userId}`);
    
    return this.documentsService.findOne(userId, id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: '更新文档',
    description: '更新指定ID的文档信息，只能更新属于当前用户的文档',
  })
  @ApiParam({
    name: 'id',
    description: '文档ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '文档更新成功',
    type: DocumentDetailResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: '请求参数无效或文档内容格式错误',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: '文档不存在',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: '未授权访问',
  })
  async update(
    @Request() req: any,
    @Param('id') id: string,
    @Body() updateDocumentDto: UpdateDocumentDto,
  ): Promise<DocumentDetailResponseDto> {
    const userId = req.user.id;
    this.logger.log(`Updating document ${id} for user ${userId}`);
    
    return this.documentsService.update(userId, id, updateDocumentDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: '删除文档',
    description: '删除指定ID的文档，只能删除属于当前用户的文档',
  })
  @ApiParam({
    name: 'id',
    description: '文档ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: '文档删除成功',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: '文档不存在',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: '未授权访问',
  })
  async remove(
    @Request() req: any,
    @Param('id') id: string,
  ): Promise<void> {
    const userId = req.user.id;
    this.logger.log(`Deleting document ${id} for user ${userId}`);
    
    return this.documentsService.remove(userId, id);
  }
}