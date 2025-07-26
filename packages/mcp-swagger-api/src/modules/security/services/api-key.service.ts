import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import * as crypto from 'crypto';
import {
  ApiKey,
  ApiKeyType,
  ApiKeyStatus,
} from '../../../database/entities/api-key.entity';
import { User } from '../../../database/entities/user.entity';
import { AuditAction, AuditLevel, AuditStatus } from '../../../database/entities/audit-log.entity';
import {
  CreateApiKeyDto,
  UpdateApiKeyDto,
  ApiKeyQueryDto,
  ApiKeyResponseDto,
  PaginatedResponseDto,
} from '../dto/security.dto';
import { AuditService } from './audit.service';

@Injectable()
export class ApiKeyService {
  private readonly logger = new Logger(ApiKeyService.name);

  constructor(
    @InjectRepository(ApiKey)
    private readonly apiKeyRepository: Repository<ApiKey>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly auditService: AuditService,
  ) {}

  /**
   * 创建API密钥
   */
  async createApiKey(
    userId: string,
    createApiKeyDto: CreateApiKeyDto,
    operatorId?: string,
    ipAddress?: string,
  ): Promise<{ apiKey: ApiKeyResponseDto; rawKey: string }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    // 生成API密钥
    const { key, hashedKey, prefix } = this.generateApiKey();

    // 创建API密钥实体
    const apiKey = this.apiKeyRepository.create({
      ...createApiKeyDto,
      user,
      keyHash: hashedKey,
      keyPrefix: prefix,
      type: createApiKeyDto.type || ApiKeyType.PERSONAL,
      status: ApiKeyStatus.ACTIVE,
    });

    const savedApiKey = await this.apiKeyRepository.save(apiKey);

    // 记录审计日志
    await this.auditService.log({
      action: AuditAction.API_KEY_CREATED,
      level: AuditLevel.INFO,
      status: AuditStatus.SUCCESS,
      userId: operatorId || userId,
      resource: 'api-keys',
      resourceId: savedApiKey.id,
      ipAddress,
      details: {
        name: savedApiKey.name,
        type: savedApiKey.type,
        userId: userId,
        prefix: savedApiKey.keyPrefix,
      },
    });

    this.logger.log(`API密钥创建成功: ${savedApiKey.name} (${savedApiKey.id})`);

    return {
      apiKey: this.toResponseDto(savedApiKey),
      rawKey: key, // 只在创建时返回完整密钥
    };
  }

  /**
   * 更新API密钥
   */
  async updateApiKey(
    id: string,
    updateApiKeyDto: UpdateApiKeyDto,
    operatorId?: string,
    ipAddress?: string,
  ): Promise<ApiKeyResponseDto> {
    const apiKey = await this.findApiKeyById(id);

    // 更新API密钥数据
    Object.assign(apiKey, updateApiKeyDto);
    const updatedApiKey = await this.apiKeyRepository.save(apiKey);

    // 记录审计日志
    await this.auditService.log({
      action: AuditAction.API_KEY_CREATED,
      level: AuditLevel.INFO,
      status: AuditStatus.SUCCESS,
      userId: operatorId,
      resource: 'api-keys',
      resourceId: updatedApiKey.id,
      ipAddress,
      details: {
        changes: updateApiKeyDto,
      },
    });

    this.logger.log(`API密钥更新成功: ${updatedApiKey.name} (${updatedApiKey.id})`);

    return this.toResponseDto(updatedApiKey);
  }

  /**
   * 删除API密钥
   */
  async deleteApiKey(
    id: string,
    operatorId?: string,
    ipAddress?: string,
  ): Promise<void> {
    const apiKey = await this.findApiKeyById(id);

    await this.apiKeyRepository.remove(apiKey);

    // 记录审计日志
    await this.auditService.log({
      action: AuditAction.API_KEY_DELETED,
      level: AuditLevel.WARNING,
      status: AuditStatus.SUCCESS,
      userId: operatorId,
      resource: 'api-keys',
      resourceId: id,
      ipAddress,
      details: {
        name: apiKey.name,
        type: apiKey.type,
        userId: apiKey.user?.id,
      },
    });

    this.logger.warn(`API密钥删除成功: ${apiKey.name} (${id})`);
  }

  /**
   * 获取API密钥详情
   */
  async getApiKeyById(id: string): Promise<ApiKeyResponseDto> {
    const apiKey = await this.findApiKeyById(id);
    return this.toResponseDto(apiKey);
  }

  /**
   * 查询API密钥列表
   */
  async getApiKeys(
    query: ApiKeyQueryDto,
  ): Promise<PaginatedResponseDto<ApiKeyResponseDto>> {
    const {
      search,
      type,
      status,
      userId,
      page = 1,
      limit = 20,
    } = query;

    const queryBuilder = this.apiKeyRepository
      .createQueryBuilder('apiKey')
      .leftJoinAndSelect('apiKey.user', 'user');

    // 搜索条件
    if (search) {
      queryBuilder.andWhere(
        '(apiKey.name LIKE :search OR apiKey.description LIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (type) {
      queryBuilder.andWhere('apiKey.type = :type', { type });
    }

    if (status) {
      queryBuilder.andWhere('apiKey.status = :status', { status });
    }

    if (userId) {
      queryBuilder.andWhere('apiKey.userId = :userId', { userId });
    }

    // 排序
    queryBuilder.orderBy('apiKey.createdAt', 'DESC');

    // 分页
    const offset = (page - 1) * limit;
    queryBuilder.skip(offset).take(limit);

    const [apiKeys, total] = await queryBuilder.getManyAndCount();

    const totalPages = Math.ceil(total / limit);

    return {
      data: apiKeys.map(apiKey => this.toResponseDto(apiKey)),
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };
  }

  /**
   * 验证API密钥
   */
  async validateApiKey(
    key: string,
    ipAddress?: string,
    userAgent?: string,
    method?: string,
    path?: string,
  ): Promise<{ valid: boolean; apiKey?: ApiKey; reason?: string }> {
    try {
      // 提取前缀
      const prefix = key.substring(0, 8);
      
      // 查找API密钥
      const apiKey = await this.apiKeyRepository.findOne({
        where: { keyPrefix: prefix },
        relations: ['user', 'user.roles', 'user.roles.permissions'],
      });

      if (!apiKey) {
        return { valid: false, reason: 'API密钥不存在' };
      }

      // 验证密钥哈希
      const isValidKey = ApiKey.validateApiKey(key, apiKey.keyHash);
      if (!isValidKey) {
        return { valid: false, reason: 'API密钥无效' };
      }

      // 检查密钥状态
      if (!apiKey.isValid) {
        return { valid: false, reason: 'API密钥已被禁用或撤销' };
      }

      // 检查过期时间
      if (apiKey.isExpired) {
        return { valid: false, reason: 'API密钥已过期' };
      }

      // 检查使用限制
      if (!apiKey.isValid) {
        return { valid: false, reason: 'API密钥使用次数已达上限' };
      }

      // 检查IP限制
      if (ipAddress && !apiKey.isIpAllowed(ipAddress)) {
        return { valid: false, reason: 'IP地址不在允许范围内' };
      }

      // 检查HTTP方法限制
      if (method && !apiKey.isMethodAllowed(method)) {
        return { valid: false, reason: 'HTTP方法不被允许' };
      }

      // 检查路径限制
      if (path && !apiKey.isPathAllowed(path)) {
        return { valid: false, reason: '访问路径不被允许' };
      }

      // 检查时间限制
      if (!apiKey.isTimeAllowed()) {
        return { valid: false, reason: '当前时间不在允许范围内' };
      }

      // 记录使用情况
      await this.recordApiKeyUsage(apiKey.id, ipAddress, userAgent);

      return { valid: true, apiKey };
    } catch (error) {
      this.logger.error('API密钥验证失败', error);
      return { valid: false, reason: '验证过程中发生错误' };
    }
  }

  /**
   * 撤销API密钥
   */
  async revokeApiKey(
    id: string,
    operatorId?: string,
    ipAddress?: string,
  ): Promise<void> {
    const apiKey = await this.findApiKeyById(id);

    apiKey.revoke();
    await this.apiKeyRepository.save(apiKey);

    // 记录审计日志
    await this.auditService.log({
      action: AuditAction.API_KEY_DELETED,
      level: AuditLevel.WARNING,
      status: AuditStatus.SUCCESS,
      userId: operatorId,
      resource: 'api-keys',
      resourceId: id,
      ipAddress,
      details: {
        name: apiKey.name,
        type: apiKey.type,
        userId: apiKey.user?.id,
      },
    });

    this.logger.warn(`API密钥撤销成功: ${apiKey.name} (${id})`);
  }

  /**
   * 重新生成API密钥
   */
  async regenerateApiKey(
    id: string,
    operatorId?: string,
    ipAddress?: string,
  ): Promise<{ apiKey: ApiKeyResponseDto; rawKey: string }> {
    const apiKey = await this.findApiKeyById(id);

    // 生成新的API密钥
    const { key, hashedKey, prefix } = this.generateApiKey();

    // 更新API密钥
    apiKey.keyHash = hashedKey;
    apiKey.keyPrefix = prefix;
    apiKey.status = ApiKeyStatus.ACTIVE;
    apiKey.usageCount = 0;
    apiKey.lastUsedAt = null;

    const updatedApiKey = await this.apiKeyRepository.save(apiKey);

    // 记录审计日志
    await this.auditService.log({
      action: AuditAction.API_KEY_CREATED,
      level: AuditLevel.WARNING,
      status: AuditStatus.SUCCESS,
      userId: operatorId,
      resource: 'api-keys',
      resourceId: id,
      ipAddress,
      details: {
        name: apiKey.name,
        type: apiKey.type,
        userId: apiKey.user?.id,
        newPrefix: prefix,
      },
    });

    this.logger.warn(`API密钥重新生成成功: ${apiKey.name} (${id})`);

    return {
      apiKey: this.toResponseDto(updatedApiKey),
      rawKey: key,
    };
  }

  /**
   * 获取用户的API密钥列表
   */
  async getUserApiKeys(userId: string): Promise<ApiKeyResponseDto[]> {
    const apiKeys = await this.apiKeyRepository.find({
      where: { user: { id: userId } },
      order: { createdAt: 'DESC' },
    });

    return apiKeys.map(apiKey => this.toResponseDto(apiKey));
  }

  /**
   * 获取API密钥使用统计
   */
  async getApiKeyStats(
    id: string,
    days: number = 30,
  ): Promise<{
    totalUsage: number;
    dailyUsage: Array<{ date: string; count: number }>;
    topIps: Array<{ ip: string; count: number }>;
    topUserAgents: Array<{ userAgent: string; count: number }>;
  }> {
    const apiKey = await this.findApiKeyById(id);

    // 这里应该从审计日志中获取使用统计
    // 为了简化，我们返回基本信息
    return {
      totalUsage: apiKey.usageCount,
      dailyUsage: [],
      topIps: [],
      topUserAgents: [],
    };
  }

  /**
   * 获取API密钥统计概览
   */
  async getApiKeyStatsOverview(): Promise<{
    totalKeys: number;
    activeKeys: number;
    expiredKeys: number;
    revokedKeys: number;
    totalUsage: number;
    recentActivity: Array<{ date: string; count: number }>;
  }> {
    const [totalKeys, activeKeys, expiredKeys, revokedKeys] = await Promise.all([
      this.apiKeyRepository.count(),
      this.apiKeyRepository.count({ where: { status: ApiKeyStatus.ACTIVE } }),
      this.apiKeyRepository.count({ where: { status: ApiKeyStatus.EXPIRED } }),
      this.apiKeyRepository.count({ where: { status: ApiKeyStatus.REVOKED } }),
    ]);

    // 计算总使用量
    const result = await this.apiKeyRepository
      .createQueryBuilder('apiKey')
      .select('SUM(apiKey.usageCount)', 'totalUsage')
      .getRawOne();

    const totalUsage = parseInt(result?.totalUsage || '0');

    return {
      totalKeys,
      activeKeys,
      expiredKeys,
      revokedKeys,
      totalUsage,
      recentActivity: [], // 可以从审计日志中获取
    };
  }

  /**
   * 清理过期的API密钥
   */
  async cleanupExpiredApiKeys(): Promise<number> {
    const expiredApiKeys = await this.apiKeyRepository.find({
      where: {
        expiresAt: MoreThan(new Date()),
        status: ApiKeyStatus.ACTIVE,
      },
    });

    for (const apiKey of expiredApiKeys) {
      apiKey.status = ApiKeyStatus.EXPIRED;
    }

    await this.apiKeyRepository.save(expiredApiKeys);

    this.logger.log(`清理了 ${expiredApiKeys.length} 个过期的API密钥`);
    return expiredApiKeys.length;
  }

  /**
   * 记录API密钥使用情况
   */
  private async recordApiKeyUsage(
    apiKeyId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    try {
      await this.apiKeyRepository
        .createQueryBuilder()
        .update(ApiKey)
        .set({
          usageCount: () => 'usageCount + 1',
          lastUsedAt: new Date(),
          lastUsedIp: ipAddress,
        })
        .where('id = :id', { id: apiKeyId })
        .execute();
    } catch (error) {
      this.logger.error('记录API密钥使用情况失败', error);
    }
  }

  /**
   * 生成API密钥
   */
  private generateApiKey(): { key: string; hashedKey: string; prefix: string } {
    // 生成32字节的随机密钥
    const randomBytes = crypto.randomBytes(32);
    const key = `mcp_${randomBytes.toString('hex')}`;
    
    // 提取前缀（前8个字符）
    const prefix = key.substring(0, 8);
    
    // 生成哈希
    const hashedKey = crypto.createHash('sha256').update(key).digest('hex');

    return { key, hashedKey, prefix };
  }

  /**
   * 根据ID查找API密钥
   */
  private async findApiKeyById(id: string): Promise<ApiKey> {
    const apiKey = await this.apiKeyRepository.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!apiKey) {
      throw new NotFoundException('API密钥不存在');
    }

    return apiKey;
  }

  /**
   * 转换为响应DTO
   */
  private toResponseDto(apiKey: ApiKey): ApiKeyResponseDto {
    return {
      id: apiKey.id,
      name: apiKey.name,
      maskedKey: apiKey.maskedKey,
      type: apiKey.type,
      status: apiKey.status,
      expiresAt: apiKey.expiresAt,
      lastUsedAt: apiKey.lastUsedAt,
      usageCount: apiKey.usageCount,
      createdAt: apiKey.createdAt,
    };
  }

  /**
   * 根据前缀查找API密钥（用于验证）
   */
  async findByPrefix(prefix: string): Promise<ApiKey | null> {
    return this.apiKeyRepository.findOne({
      where: { keyPrefix: prefix },
      relations: ['user', 'user.roles', 'user.roles.permissions'],
    });
  }

  /**
   * 检查API密钥权限
   */
  async checkApiKeyPermission(
    apiKey: ApiKey,
    permission: string,
  ): Promise<boolean> {
    // 如果API密钥有特定权限设置，检查特定权限
    if (apiKey.permissions && apiKey.permissions.length > 0) {
      return apiKey.permissions.includes(permission);
    }

    // 否则检查用户权限
    if (apiKey.user && apiKey.user.roles) {
      for (const role of apiKey.user.roles) {
        if (role.permissions) {
          for (const rolePermission of role.permissions) {
            if (rolePermission.name === permission && rolePermission.enabled) {
              return true;
            }
          }
        }
      }
    }

    return false;
  }
}