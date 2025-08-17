import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { SystemLogEntity, SystemLogLevel, SystemLogEventType } from '../../../database/entities/system-log.entity';
import { MCPServerEntity } from '../../../database/entities/mcp-server.entity';
import { SystemLogResponseDto } from '../dto/system-log.dto';

export interface CreateSystemLogDto {
  serverId: string;
  eventType: SystemLogEventType;
  description: string;
  level?: SystemLogLevel;
  details?: Record<string, any>;
}

export interface QuerySystemLogDto {
  serverId?: string;
  eventType?: SystemLogEventType;
  level?: SystemLogLevel;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

@Injectable()
export class SystemLogService {
  private readonly logger = new Logger(SystemLogService.name);

  constructor(
    @InjectRepository(SystemLogEntity)
    private readonly systemLogRepository: Repository<SystemLogEntity>,
    @InjectRepository(MCPServerEntity)
    private readonly mcpServerRepository: Repository<MCPServerEntity>,
  ) {}

  /**
   * 创建系统日志记录
   */
  async createLog(data: CreateSystemLogDto): Promise<SystemLogEntity> {
    try {
      const logEntry = this.systemLogRepository.create({
        serverId: data.serverId,
        eventType: data.eventType,
        message: data.description,
        level: data.level || SystemLogLevel.INFO,
        context: data.details,
      });

      return await this.systemLogRepository.save(logEntry);
    } catch (error) {
      this.logger.error('Failed to create system log', error);
      throw error;
    }
  }

  /**
   * 查询系统日志
   */
  async queryLogs(queryDto: QuerySystemLogDto) {
    const {
      serverId,
      eventType,
      level,
      startDate,
      endDate,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = queryDto;

    const queryBuilder = this.systemLogRepository.createQueryBuilder('log');

    // 添加查询条件
    if (serverId) {
      queryBuilder.andWhere('log.serverId = :serverId', { serverId });
    }

    if (eventType) {
      queryBuilder.andWhere('log.eventType = :eventType', { eventType });
    }

    if (level) {
      queryBuilder.andWhere('log.level = :level', { level });
    }

    if (startDate && endDate) {
      queryBuilder.andWhere('log.createdAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      });
    } else if (startDate) {
      queryBuilder.andWhere('log.createdAt >= :startDate', { startDate });
    } else if (endDate) {
      queryBuilder.andWhere('log.createdAt <= :endDate', { endDate });
    }

    // 排序和分页
    queryBuilder
      .orderBy(`log.${sortBy}`, sortOrder)
      .skip((page - 1) * limit)
      .take(limit);

    const [logs, total] = await queryBuilder.getManyAndCount();

    return {
      logs: logs.map(log => this.entityToDto(log)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * 根据服务器ID获取最新日志
   */
  async getLatestLogs(serverId: string, limit: number = 10): Promise<SystemLogResponseDto[]> {
    const logs = await this.systemLogRepository.find({
      where: { serverId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
    return logs.map(log => this.entityToDto(log));
  }

  /**
   * 将实体转换为DTO
   */
  private entityToDto(entity: SystemLogEntity): SystemLogResponseDto {
    return {
      id: entity.id,
      serverId: entity.serverId,
      eventType: entity.eventType,
      description: entity.description || entity.message || '',
      level: entity.level,
      details: entity.context || entity.metadata,
      createdAt: entity.createdAt,
      updatedAt: entity.createdAt, // SystemLogEntity没有updatedAt字段，使用createdAt
    };
  }

  /**
   * 删除指定时间之前的日志
   */
  async cleanupOldLogs(beforeDate: Date): Promise<number> {
    const result = await this.systemLogRepository.delete({
      createdAt: Between(new Date(0), beforeDate),
    });
    return result.affected || 0;
  }
}