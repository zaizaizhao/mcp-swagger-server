import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, In } from 'typeorm';
import { OpenAPIDocument, DocumentStatus } from '../../../database/entities/openapi-document.entity';
import { User } from '../../../database/entities/user.entity';
import { CreateDocumentDto } from '../dto/create-document.dto';
import { UpdateDocumentDto } from '../dto/update-document.dto';
import { QueryDocumentDto } from '../dto/query-document.dto';
import {
  DocumentResponseDto,
  DocumentDetailResponseDto,
  DocumentListResponseDto,
  DocumentInfoDto,
} from '../dto/document-response.dto';

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    @InjectRepository(OpenAPIDocument)
    private readonly documentRepository: Repository<OpenAPIDocument>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * 创建新文档
   */
  async create(userId: string, createDocumentDto: CreateDocumentDto): Promise<DocumentDetailResponseDto> {
    try {
      // 验证内容是否为有效的JSON
      this.validateJsonContent(createDocumentDto.content);

      const document = this.documentRepository.create({
        ...createDocumentDto,
        userId,
      });

      const savedDocument = await this.documentRepository.save(document);
      
      this.logger.log(`Created document ${savedDocument.id} for user ${userId}`);
      
      return this.toDetailResponseDto(savedDocument);
    } catch (error) {
      this.logger.error(`Failed to create document for user ${userId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * 获取用户文档列表
   */
  async findAll(userId: string, queryDto: QueryDocumentDto): Promise<DocumentListResponseDto> {
    try {
      const { page, limit, search, status, tags, sortBy, sortOrder } = queryDto;
      const skip = (page - 1) * limit;

      const queryBuilder = this.documentRepository
        .createQueryBuilder('document')
        .where('document.userId = :userId', { userId });

      // 搜索过滤
      if (search) {
        queryBuilder.andWhere(
          '(document.name ILIKE :search OR document.description ILIKE :search)',
          { search: `%${search}%` }
        );
      }

      // 状态过滤
      if (status) {
        queryBuilder.andWhere('document.status = :status', { status });
      }

      // 标签过滤
      if (tags && tags.length > 0) {
        queryBuilder.andWhere('document.tags && :tags', { tags });
      }

      // 排序
      queryBuilder.orderBy(`document.${sortBy}`, sortOrder);

      // 分页
      queryBuilder.skip(skip).take(limit);

      const [documents, total] = await queryBuilder.getManyAndCount();
      const totalPages = Math.ceil(total / limit);

      this.logger.log(`Found ${documents.length} documents for user ${userId}`);

      return {
        documents: documents.map(doc => this.toResponseDto(doc)),
        total,
        page,
        limit,
        totalPages,
      };
    } catch (error) {
      this.logger.error(`Failed to get documents for user ${userId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * 获取单个文档详情
   */
  async findOne(userId: string | null, id: string): Promise<DocumentDetailResponseDto> {
    try {
      const whereCondition = userId ? { id, userId } : { id };
      const document = await this.documentRepository.findOne({
        where: whereCondition,
      });

      if (!document) {
        throw new NotFoundException(`Document with ID ${id} not found`);
      }

      this.logger.log(`Retrieved document ${id}${userId ? ` for user ${userId}` : ''}`);
      
      return this.toDetailResponseDto(document);
    } catch (error) {
      this.logger.error(`Failed to get document ${id}${userId ? ` for user ${userId}` : ''}: ${error.message}`);
      throw error;
    }
  }

  /**
   * 更新文档
   */
  async update(userId: string, id: string, updateDocumentDto: UpdateDocumentDto): Promise<DocumentDetailResponseDto> {
    try {
      const document = await this.documentRepository.findOne({
        where: { id, userId },
      });

      if (!document) {
        throw new NotFoundException(`Document with ID ${id} not found`);
      }

      // 如果更新内容，验证JSON格式
      if (updateDocumentDto.content) {
        this.validateJsonContent(updateDocumentDto.content);
      }

      // 更新文档
      Object.assign(document, updateDocumentDto);
      const updatedDocument = await this.documentRepository.save(document);

      this.logger.log(`Updated document ${id} for user ${userId}`);
      
      return this.toDetailResponseDto(updatedDocument);
    } catch (error) {
      this.logger.error(`Failed to update document ${id} for user ${userId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * 删除文档
   */
  async remove(userId: string, id: string): Promise<void> {
    try {
      const document = await this.documentRepository.findOne({
        where: { id, userId },
      });

      if (!document) {
        throw new NotFoundException(`Document with ID ${id} not found`);
      }

      await this.documentRepository.remove(document);
      
      this.logger.log(`Deleted document ${id} for user ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to delete document ${id} for user ${userId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * 验证JSON内容格式
   */
  private validateJsonContent(content: string): void {
    try {
      const parsed = JSON.parse(content);
      
      // 基本的OpenAPI规范验证
      if (!parsed.openapi && !parsed.swagger) {
        throw new BadRequestException('Content must be a valid OpenAPI/Swagger specification');
      }
      
      if (!parsed.info || !parsed.info.title || !parsed.info.version) {
        throw new BadRequestException('OpenAPI specification must have info.title and info.version');
      }
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Content must be valid JSON');
    }
  }

  /**
   * 转换为响应DTO（不包含content）
   */
  private toResponseDto(document: OpenAPIDocument): DocumentResponseDto {
    const info = document.getInfo();
    const endpointCount = document.getEndpointCount();

    return {
      id: document.id,
      name: document.name,
      description: document.description,
      status: document.status,
      version: document.version,
      tags: document.tags,
      metadata: document.metadata,
      userId: document.userId,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
      info,
      endpointCount,
    };
  }

  /**
   * 转换为详细响应DTO（包含content）
   */
  private toDetailResponseDto(document: OpenAPIDocument): DocumentDetailResponseDto {
    const baseDto = this.toResponseDto(document);
    
    return {
      ...baseDto,
      content: document.content,
    };
  }
}