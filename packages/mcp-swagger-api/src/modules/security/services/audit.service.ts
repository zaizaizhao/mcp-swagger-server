import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, Like } from 'typeorm';
import {
  AuditLog,
  AuditAction,
  AuditLevel,
  AuditStatus,
} from '../../../database/entities/audit-log.entity';
import { User } from '../../../database/entities/user.entity';
import { AuditLogQueryDto, PaginatedResponseDto } from '../dto/security.dto';

export interface CreateAuditLogDto {
  action: AuditAction;
  level: AuditLevel;
  status: AuditStatus;
  userId?: string;
  resource?: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  details?: any;
  metadata?: any;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * 记录审计日志
   */
  async log(data: CreateAuditLogDto): Promise<AuditLog> {
    try {
      const auditLog = this.auditLogRepository.create({
        ...data,
        createdAt: new Date(),
      });

      const savedLog = await this.auditLogRepository.save(auditLog);

      // 如果是高风险操作，记录到系统日志
      if (this.isHighRiskOperation(data.action, data.level)) {
        this.logger.warn(
          `高风险操作: ${data.action} - 用户: ${data.userId} - 资源: ${data.resource}/${data.resourceId} - IP: ${data.ipAddress}`,
        );
      }

      return savedLog;
    } catch (error) {
      this.logger.error('审计日志记录失败', error);
      // 即使审计日志记录失败，也不应该影响主要业务逻辑
      throw error;
    }
  }

  /**
   * 批量记录审计日志
   */
  async logBatch(logs: CreateAuditLogDto[]): Promise<AuditLog[]> {
    try {
      const auditLogs = logs.map(data =>
        this.auditLogRepository.create({
          ...data,
          createdAt: new Date(),
        }),
      );

      return await this.auditLogRepository.save(auditLogs);
    } catch (error) {
      this.logger.error('批量审计日志记录失败', error);
      throw error;
    }
  }

  /**
   * 查询审计日志
   */
  async findLogs(
    query: AuditLogQueryDto,
  ): Promise<PaginatedResponseDto<AuditLog>> {
    const {
      search,
      action,
      level,
      status,
      userId,
      resource,
      ipAddress,
      startDate,
      endDate,
      page = 1,
      limit = 20,
    } = query;

    const queryBuilder = this.auditLogRepository
      .createQueryBuilder('audit')
      .leftJoinAndSelect('audit.user', 'user');

    // 搜索条件
    if (search) {
      queryBuilder.andWhere(
        '(audit.action LIKE :search OR audit.resource LIKE :search OR audit.details LIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (action) {
      queryBuilder.andWhere('audit.action = :action', { action });
    }

    if (level) {
      queryBuilder.andWhere('audit.level = :level', { level });
    }

    if (status) {
      queryBuilder.andWhere('audit.status = :status', { status });
    }

    if (userId) {
      queryBuilder.andWhere('audit.userId = :userId', { userId });
    }

    if (resource) {
      queryBuilder.andWhere('audit.resource = :resource', { resource });
    }

    if (ipAddress) {
      queryBuilder.andWhere('audit.ipAddress = :ipAddress', { ipAddress });
    }

    // 时间范围
    if (startDate && endDate) {
      queryBuilder.andWhere('audit.timestamp BETWEEN :startDate AND :endDate', {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      });
    } else if (startDate) {
      queryBuilder.andWhere('audit.timestamp >= :startDate', {
        startDate: new Date(startDate),
      });
    } else if (endDate) {
      queryBuilder.andWhere('audit.timestamp <= :endDate', {
        endDate: new Date(endDate),
      });
    }

    // 排序
    queryBuilder.orderBy('audit.timestamp', 'DESC');

    // 分页
    const offset = (page - 1) * limit;
    queryBuilder.skip(offset).take(limit);

    const [logs, total] = await queryBuilder.getManyAndCount();

    const totalPages = Math.ceil(total / limit);

    return {
      data: logs,
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };
  }

  /**
   * 根据ID获取审计日志
   */
  async findLogById(id: string): Promise<AuditLog> {
    const log = await this.auditLogRepository.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!log) {
      throw new Error('审计日志不存在');
    }

    return log;
  }

  /**
   * 获取用户操作统计
   */
  async getUserActivityStats(
    userId: string,
    days: number = 30,
  ): Promise<{
    totalActions: number;
    successActions: number;
    failedActions: number;
    actionsByType: Record<string, number>;
    dailyActivity: Array<{ date: string; count: number }>;
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const logs = await this.auditLogRepository.find({
      where: {
        userId,
        createdAt: Between(startDate, new Date()),
      },
      order: { createdAt: 'ASC' },
    });

    const totalActions = logs.length;
    const successActions = logs.filter(log => log.status === AuditStatus.SUCCESS).length;
    const failedActions = logs.filter(log => log.status === AuditStatus.FAILED).length;

    // 按操作类型统计
    const actionsByType: Record<string, number> = {};
    logs.forEach(log => {
      actionsByType[log.action] = (actionsByType[log.action] || 0) + 1;
    });

    // 按日期统计
    const dailyActivity: Array<{ date: string; count: number }> = [];
    const dateMap = new Map<string, number>();

    logs.forEach(log => {
      const date = log.createdAt.toISOString().split('T')[0];
      dateMap.set(date, (dateMap.get(date) || 0) + 1);
    });

    // 填充所有日期（包括没有活动的日期）
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      dailyActivity.unshift({
        date: dateStr,
        count: dateMap.get(dateStr) || 0,
      });
    }

    return {
      totalActions,
      successActions,
      failedActions,
      actionsByType,
      dailyActivity,
    };
  }

  /**
   * 获取系统安全事件
   */
  async getSecurityEvents(
    days: number = 7,
  ): Promise<{
    suspiciousLogins: AuditLog[];
    failedLogins: AuditLog[];
    privilegeEscalations: AuditLog[];
    dataAccess: AuditLog[];
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [suspiciousLogins, failedLogins, privilegeEscalations, dataAccess] =
      await Promise.all([
        // 可疑登录（多次失败后成功）
        this.auditLogRepository
          .createQueryBuilder('audit')
          .leftJoinAndSelect('audit.user', 'user')
          .where('audit.action = :action', { action: AuditAction.USER_LOGIN })
          .andWhere('audit.createdAt >= :startDate', { startDate })
          .andWhere('audit.level = :level', { level: AuditLevel.WARNING })
          .orderBy('audit.createdAt', 'DESC')
          .limit(50)
          .getMany(),

        // 登录失败
        this.auditLogRepository
          .createQueryBuilder('audit')
          .leftJoinAndSelect('audit.user', 'user')
          .where('audit.action = :action', { action: AuditAction.USER_LOGIN })
          .andWhere('audit.status = :status', { status: AuditStatus.FAILED })
          .andWhere('audit.createdAt >= :startDate', { startDate })
          .orderBy('audit.createdAt', 'DESC')
          .limit(100)
          .getMany(),

        // 权限提升
        this.auditLogRepository
          .createQueryBuilder('audit')
          .leftJoinAndSelect('audit.user', 'user')
          .where('audit.action IN (:...actions)', {
            actions: [AuditAction.USER_ROLE_ASSIGNED, AuditAction.PERMISSION_GRANTED],
          })
          .andWhere('audit.createdAt >= :startDate', { startDate })
          .orderBy('audit.createdAt', 'DESC')
          .limit(50)
          .getMany(),

        // 敏感数据访问
        this.auditLogRepository
          .createQueryBuilder('audit')
          .leftJoinAndSelect('audit.user', 'user')
          .where('audit.level = :level', { level: AuditLevel.CRITICAL })
          .andWhere('audit.createdAt >= :startDate', { startDate })
          .orderBy('audit.createdAt', 'DESC')
          .limit(50)
          .getMany(),
      ]);

    return {
      suspiciousLogins,
      failedLogins,
      privilegeEscalations,
      dataAccess,
    };
  }

  /**
   * 获取可疑登录记录
   */
  async getSuspiciousLogins(query: any): Promise<any> {
    const { page = 1, limit = 20, startDate, endDate } = query;
    const queryBuilder = this.auditLogRepository
      .createQueryBuilder('audit')
      .leftJoinAndSelect('audit.user', 'user')
      .where('audit.action = :action', { action: AuditAction.USER_LOGIN })
      .andWhere('audit.level = :level', { level: AuditLevel.WARNING });

    if (startDate) {
      queryBuilder.andWhere('audit.createdAt >= :startDate', { startDate });
    }
    if (endDate) {
      queryBuilder.andWhere('audit.createdAt <= :endDate', { endDate });
    }

    const [data, total] = await queryBuilder
      .orderBy('audit.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1,
    };
  }

  /**
   * 获取失败登录记录
   */
  async getFailedLogins(query: any): Promise<any> {
    const { page = 1, limit = 20, startDate, endDate } = query;
    const queryBuilder = this.auditLogRepository
      .createQueryBuilder('audit')
      .leftJoinAndSelect('audit.user', 'user')
      .where('audit.action = :action', { action: AuditAction.USER_LOGIN })
      .andWhere('audit.status = :status', { status: AuditStatus.FAILED });

    if (startDate) {
      queryBuilder.andWhere('audit.createdAt >= :startDate', { startDate });
    }
    if (endDate) {
      queryBuilder.andWhere('audit.createdAt <= :endDate', { endDate });
    }

    const [data, total] = await queryBuilder
      .orderBy('audit.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1,
    };
  }

  /**
   * 获取权限提升记录
   */
  async getPrivilegeEscalations(query: any): Promise<any> {
    const { page = 1, limit = 20, startDate, endDate } = query;
    const queryBuilder = this.auditLogRepository
      .createQueryBuilder('audit')
      .leftJoinAndSelect('audit.user', 'user')
      .where('audit.action IN (:...actions)', {
        actions: [AuditAction.USER_ROLE_ASSIGNED, AuditAction.PERMISSION_GRANTED],
      });

    if (startDate) {
      queryBuilder.andWhere('audit.createdAt >= :startDate', { startDate });
    }
    if (endDate) {
      queryBuilder.andWhere('audit.createdAt <= :endDate', { endDate });
    }

    const [data, total] = await queryBuilder
      .orderBy('audit.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1,
    };
  }

  /**
   * 获取敏感数据访问记录
   */
  async getSensitiveDataAccess(query: any): Promise<any> {
    const { page = 1, limit = 20, startDate, endDate } = query;
    const queryBuilder = this.auditLogRepository
      .createQueryBuilder('audit')
      .leftJoinAndSelect('audit.user', 'user')
      .where('audit.level = :level', { level: AuditLevel.CRITICAL });

    if (startDate) {
      queryBuilder.andWhere('audit.createdAt >= :startDate', { startDate });
    }
    if (endDate) {
      queryBuilder.andWhere('audit.createdAt <= :endDate', { endDate });
    }

    const [data, total] = await queryBuilder
      .orderBy('audit.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1,
    };
  }

  /**
   * 搜索审计日志
   */
  async searchLogs(query: any, options: any): Promise<any> {
    const {
      search,
      action,
      level,
      status,
      userId,
      resource,
      startDate,
      endDate,
      page = 1,
      limit = 20,
    } = query;

    const queryBuilder = this.auditLogRepository
      .createQueryBuilder('log')
      .leftJoinAndSelect('log.user', 'user');

    // 搜索条件
    if (search) {
      queryBuilder.andWhere(
        '(log.details LIKE :search OR log.resource LIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (action) {
      queryBuilder.andWhere('log.action = :action', { action });
    }

    if (level) {
      queryBuilder.andWhere('log.level = :level', { level });
    }

    if (status) {
      queryBuilder.andWhere('log.status = :status', { status });
    }

    if (userId) {
      queryBuilder.andWhere('log.userId = :userId', { userId });
    }

    if (resource) {
      queryBuilder.andWhere('log.resource = :resource', { resource });
    }

    if (startDate) {
      queryBuilder.andWhere('log.createdAt >= :startDate', { startDate });
    }

    if (endDate) {
      queryBuilder.andWhere('log.createdAt <= :endDate', { endDate });
    }

    // 排序
    queryBuilder.orderBy('log.createdAt', 'DESC');

    // 分页
    const offset = (page - 1) * limit;
    queryBuilder.skip(offset).take(limit);

    const [logs, total] = await queryBuilder.getManyAndCount();
    const totalPages = Math.ceil(total / limit);

    return {
      data: logs,
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };
  }

  /**
   * 获取用户时间线
   */
  async getUserTimeline(userId: string, options: any): Promise<any> {
    const {
      startDate,
      endDate,
      page = 1,
      limit = 50,
    } = options;

    const queryBuilder = this.auditLogRepository
      .createQueryBuilder('log')
      .where('log.userId = :userId', { userId });

    if (startDate) {
      queryBuilder.andWhere('log.createdAt >= :startDate', { startDate });
    }

    if (endDate) {
      queryBuilder.andWhere('log.createdAt <= :endDate', { endDate });
    }

    // 排序
    queryBuilder.orderBy('log.createdAt', 'DESC');

    // 分页
    const offset = (page - 1) * limit;
    queryBuilder.skip(offset).take(limit);

    const [logs, total] = await queryBuilder.getManyAndCount();
    const totalPages = Math.ceil(total / limit);

    return {
      data: logs,
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };
  }

  /**
   * 清理过期的审计日志
   */
  async cleanupOldLogs(retentionDays: number = 365): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await this.auditLogRepository
      .createQueryBuilder()
      .delete()
      .where('timestamp < :cutoffDate', { cutoffDate })
      .execute();

    const deletedCount = result.affected || 0;
    this.logger.log(`清理了 ${deletedCount} 条过期审计日志`);

    return deletedCount;
  }

  /**
   * 导出审计日志
   */
  async exportLogs(
    query: AuditLogQueryDto,
    format: 'json' | 'csv' = 'json',
  ): Promise<string> {
    const { data } = await this.findLogs({ ...query, limit: 10000 });

    if (format === 'csv') {
      return this.convertToCSV(data);
    }

    return JSON.stringify(data, null, 2);
  }

  /**
   * 转换为CSV格式
   */
  private convertToCSV(logs: AuditLog[]): string {
    if (logs.length === 0) {
      return '';
    }

    const headers = [
      'ID',
      'Timestamp',
      'Action',
      'Level',
      'Status',
      'User',
      'Resource',
      'Resource ID',
      'IP Address',
      'User Agent',
      'Details',
    ];

    const rows = logs.map(log => [
      log.id,
      log.createdAt.toISOString(),
      log.action,
      log.level,
      log.status,
      log.user?.username || '',
      log.resource || '',
      log.resourceId || '',
      log.ipAddress || '',
      log.userAgent || '',
      JSON.stringify(log.details || {}),
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    return csvContent;
  }

  /**
   * 判断是否为高风险操作
   */
  private isHighRiskOperation(action: AuditAction, level: AuditLevel): boolean {
    const highRiskActions = [
      AuditAction.USER_DELETED,
      AuditAction.USER_ROLE_ASSIGNED,
      AuditAction.PERMISSION_GRANTED,
      AuditAction.CONFIG_UPDATED,
      AuditAction.SYSTEM_MAINTENANCE,
    ];

    return (
      highRiskActions.includes(action) ||
      level === AuditLevel.CRITICAL ||
      level === AuditLevel.ERROR
    );
  }

  /**
   * 获取审计统计信息
   */
  async getAuditStats(query: any): Promise<any> {
    const { startDate, endDate } = query;
    const queryBuilder = this.auditLogRepository.createQueryBuilder('audit');

    if (startDate) {
      queryBuilder.andWhere('audit.createdAt >= :startDate', { startDate });
    }
    if (endDate) {
      queryBuilder.andWhere('audit.createdAt <= :endDate', { endDate });
    }

    const [totalLogs, successLogs, failedLogs, warningLogs, errorLogs] = await Promise.all([
      queryBuilder.getCount(),
      queryBuilder.clone().andWhere('audit.status = :status', { status: AuditStatus.SUCCESS }).getCount(),
      queryBuilder.clone().andWhere('audit.status = :status', { status: AuditStatus.FAILED }).getCount(),
      queryBuilder.clone().andWhere('audit.level = :level', { level: AuditLevel.WARNING }).getCount(),
      queryBuilder.clone().andWhere('audit.level = :level', { level: AuditLevel.ERROR }).getCount(),
    ]);

    return {
      totalLogs,
      successLogs,
      failedLogs,
      warningLogs,
      errorLogs,
      successRate: totalLogs > 0 ? (successLogs / totalLogs * 100).toFixed(2) : 0,
    };
  }

  /**
   * 清理过期审计日志
   */
  async cleanupExpiredLogs(days: number, userId: string, ipAddress: string): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const result = await this.auditLogRepository
      .createQueryBuilder()
      .delete()
      .where('createdAt < :cutoffDate', { cutoffDate })
      .execute();

    // 记录清理操作
    await this.log({
      action: AuditAction.SYSTEM_MAINTENANCE,
      level: AuditLevel.INFO,
      status: AuditStatus.SUCCESS,
      userId,
      resource: 'audit',
      ipAddress,
      details: {
        operation: 'cleanup_expired_logs',
        days,
        deletedCount: result.affected,
      },
    });

    return result.affected || 0;
  }

  /**
   * 记录用户登录
   */
  async logUserLogin(
    userId: string,
    ipAddress: string,
    userAgent: string,
    success: boolean,
    details?: any,
  ): Promise<void> {
    await this.log({
      action: AuditAction.USER_LOGIN,
      level: success ? AuditLevel.INFO : AuditLevel.WARNING,
      status: success ? AuditStatus.SUCCESS : AuditStatus.FAILED,
      userId,
      resource: 'auth',
      ipAddress,
      userAgent,
      details,
    });
  }

  /**
   * 记录用户登出
   */
  async logUserLogout(
    userId: string,
    ipAddress: string,
    userAgent: string,
  ): Promise<void> {
    await this.log({
      action: AuditAction.USER_LOGOUT,
      level: AuditLevel.INFO,
      status: AuditStatus.SUCCESS,
      userId,
      resource: 'auth',
      ipAddress,
      userAgent,
    });
  }

  /**
   * 记录API访问
   */
  async logApiAccess(
    userId: string | undefined,
    method: string,
    path: string,
    statusCode: number,
    ipAddress: string,
    userAgent: string,
    responseTime?: number,
  ): Promise<void> {
    const success = statusCode >= 200 && statusCode < 400;
    const level = statusCode >= 500 ? AuditLevel.ERROR : AuditLevel.INFO;

    await this.log({
      action: AuditAction.API_CALLED,
      level,
      status: success ? AuditStatus.SUCCESS : AuditStatus.FAILED,
      userId,
      resource: 'api',
      ipAddress,
      userAgent,
      details: {
        method,
        path,
        statusCode,
        responseTime,
      },
    });
  }
}