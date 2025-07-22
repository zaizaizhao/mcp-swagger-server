import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { v4 as uuidv4 } from 'uuid';

import { MCPServerEntity, ServerStatus, TransportType } from '../../../database/entities/mcp-server.entity';
import { LogEntryEntity, LogLevel, LogSource } from '../../../database/entities/log-entry.entity';
import { ServerLifecycleService } from './server-lifecycle.service';
import { CreateServerDto, UpdateServerDto, ServerQueryDto } from '../dto/server.dto';

export interface ServerInstance {
  id: string;
  entity: MCPServerEntity;
  mcpServer?: any; // MCP服务器实例
  httpServer?: any; // HTTP服务器实例
  startTime?: Date;
  lastActivity?: Date;
}

@Injectable()
export class ServerManagerService {
  private readonly logger = new Logger(ServerManagerService.name);
  private readonly serverInstances = new Map<string, ServerInstance>();

  constructor(
    @InjectRepository(MCPServerEntity)
    private readonly serverRepository: Repository<MCPServerEntity>,
    @InjectRepository(LogEntryEntity)
    private readonly logRepository: Repository<LogEntryEntity>,
    private readonly lifecycleService: ServerLifecycleService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.initializeExistingServers();
  }

  /**
   * 初始化时加载现有服务器
   */
  private async initializeExistingServers(): Promise<void> {
    try {
      const servers = await this.serverRepository.find({
        where: { autoStart: true },
      });

      this.logger.log(`Found ${servers.length} servers with auto-start enabled`);

      for (const server of servers) {
        if (server.status === ServerStatus.RUNNING) {
          // 重置状态，因为应用重启后服务器实际上已停止
          await this.updateServerStatus(server.id, ServerStatus.STOPPED);
        }
        
        // 创建服务器实例记录
        this.serverInstances.set(server.id, {
          id: server.id,
          entity: server,
        });

        // 如果启用了自动启动，尝试启动服务器
        if (server.autoStart) {
          try {
            await this.startServer(server.id);
          } catch (error) {
            this.logger.error(`Failed to auto-start server ${server.name}:`, error);
            await this.logError(server.id, 'Auto-start failed', error);
          }
        }
      }
    } catch (error) {
      this.logger.error('Failed to initialize existing servers:', error);
    }
  }

  /**
   * 创建新的MCP服务器
   */
  async createServer(createDto: CreateServerDto): Promise<MCPServerEntity> {
    // 检查名称是否已存在
    const existingServer = await this.serverRepository.findOne({
      where: { name: createDto.name },
    });

    if (existingServer) {
      throw new ConflictException(`Server with name '${createDto.name}' already exists`);
    }

    // 检查端口是否已被使用
    if (createDto.port) {
      const serverWithPort = await this.serverRepository.findOne({
        where: { port: createDto.port, status: ServerStatus.RUNNING },
      });

      if (serverWithPort) {
        throw new ConflictException(`Port ${createDto.port} is already in use by server '${serverWithPort.name}'`);
      }
    }

    // 验证OpenAPI数据
    try {
      await this.lifecycleService.validateOpenApiData(createDto.openApiData);
    } catch (error) {
      throw new ConflictException(`Invalid OpenAPI specification: ${error.message}`);
    }

    // 创建服务器实体
    const server = this.serverRepository.create({
      name: createDto.name,
      version: createDto.version || '1.0.0',
      description: createDto.description,
      port: createDto.port || await this.findAvailablePort(),
      transport: createDto.transport || TransportType.STREAMABLE,
      openApiData: createDto.openApiData,
      config: createDto.config,
      status: ServerStatus.STOPPED,
      healthy: false,
    } as any);

    const savedServers = await this.serverRepository.save(server);
    const savedServer = Array.isArray(savedServers) ? savedServers[0] : savedServers;

    // 创建服务器实例记录
    this.serverInstances.set(savedServer.id, {
      id: savedServer.id,
      entity: savedServer,
    });

    await this.logInfo(savedServer.id, `Server '${savedServer.name}' created successfully`);
    
    this.eventEmitter.emit('server.created', {
      serverId: savedServer.id,
      serverName: savedServer.name,
    });

    return savedServer;
  }

  /**
   * 获取所有服务器
   */
  async getAllServers(query?: ServerQueryDto): Promise<{
    servers: MCPServerEntity[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page = 1, limit = 10, status, transport, search, tags } = query || {};
    
    const queryBuilder = this.serverRepository.createQueryBuilder('server');

    // 添加过滤条件
    if (status) {
      queryBuilder.andWhere('server.status = :status', { status });
    }

    if (transport) {
      queryBuilder.andWhere('server.transport = :transport', { transport });
    }

    if (search) {
      queryBuilder.andWhere(
        '(server.name ILIKE :search OR server.description ILIKE :search)',
        { search: `%${search}%` }
      );
    }

    if (tags && tags.length > 0) {
      queryBuilder.andWhere('server.tags && :tags', { tags });
    }

    // 分页
    const offset = (page - 1) * limit;
    queryBuilder.skip(offset).take(limit);

    // 排序
    queryBuilder.orderBy('server.updatedAt', 'DESC');

    const [servers, total] = await queryBuilder.getManyAndCount();

    return {
      servers,
      total,
      page,
      limit,
    };
  }

  /**
   * 根据ID获取服务器
   */
  async getServerById(id: string): Promise<MCPServerEntity> {
    const server = await this.serverRepository.findOne({ where: { id } });
    
    if (!server) {
      throw new NotFoundException(`Server with ID '${id}' not found`);
    }

    return server;
  }

  /**
   * 更新服务器配置
   */
  async updateServer(id: string, updateDto: UpdateServerDto): Promise<MCPServerEntity> {
    const server = await this.getServerById(id);

    // 如果服务器正在运行，某些字段不能修改
    if (server.status === ServerStatus.RUNNING) {
      if (updateDto.port && updateDto.port !== server.port) {
        throw new ConflictException('Cannot change port while server is running');
      }
      if (updateDto.transport && updateDto.transport !== server.transport) {
        throw new ConflictException('Cannot change transport while server is running');
      }
    }

    // 检查名称冲突
    if (updateDto.name && updateDto.name !== server.name) {
      const existingServer = await this.serverRepository.findOne({
        where: { name: updateDto.name },
      });
      
      if (existingServer && existingServer.id !== id) {
        throw new ConflictException(`Server with name '${updateDto.name}' already exists`);
      }
    }

    // 检查端口冲突
    if (updateDto.port && updateDto.port !== server.port) {
      const serverWithPort = await this.serverRepository.findOne({
        where: { port: updateDto.port, status: ServerStatus.RUNNING },
      });
      
      if (serverWithPort && serverWithPort.id !== id) {
        throw new ConflictException(`Port ${updateDto.port} is already in use`);
      }
    }

    // 验证新的OpenAPI数据（如果提供）
    if (updateDto.openApiData) {
      try {
        await this.lifecycleService.validateOpenApiData(updateDto.openApiData);
      } catch (error) {
        throw new ConflictException(`Invalid OpenAPI specification: ${error.message}`);
      }
    }

    // 更新实体
    Object.assign(server, updateDto);
    const updatedServer = await this.serverRepository.save(server);

    // 更新内存中的实例
    const instance = this.serverInstances.get(id);
    if (instance) {
      instance.entity = updatedServer;
    }

    await this.logInfo(id, `Server '${updatedServer.name}' updated successfully`);
    
    this.eventEmitter.emit('server.updated', {
      serverId: id,
      serverName: updatedServer.name,
      changes: updateDto,
    });

    return updatedServer;
  }

  /**
   * 删除服务器
   */
  async deleteServer(id: string): Promise<void> {
    const server = await this.getServerById(id);

    // 如果服务器正在运行，先停止它
    if (server.status === ServerStatus.RUNNING) {
      await this.stopServer(id);
    }

    // 删除数据库记录
    await this.serverRepository.remove(server);

    // 删除内存中的实例
    this.serverInstances.delete(id);

    await this.logInfo(id, `Server '${server.name}' deleted successfully`);
    
    this.eventEmitter.emit('server.deleted', {
      serverId: id,
      serverName: server.name,
    });
  }

  /**
   * 启动服务器
   */
  async startServer(id: string): Promise<void> {
    const server = await this.getServerById(id);
    
    if (server.status === ServerStatus.RUNNING) {
      throw new ConflictException('Server is already running');
    }

    if (server.status === ServerStatus.STARTING) {
      throw new ConflictException('Server is already starting');
    }

    await this.updateServerStatus(id, ServerStatus.STARTING);
    
    try {
      const instance = await this.lifecycleService.startServer(server);
      
      // 更新内存中的实例
      this.serverInstances.set(id, {
        ...this.serverInstances.get(id)!,
        mcpServer: instance.mcpServer,
        httpServer: instance.httpServer,
        startTime: new Date(),
        lastActivity: new Date(),
      });

      await this.updateServerStatus(id, ServerStatus.RUNNING, instance.endpoint);
      await this.logInfo(id, `Server '${server.name}' started successfully on ${instance.endpoint}`);
      
      this.eventEmitter.emit('server.started', {
        serverId: id,
        serverName: server.name,
        endpoint: instance.endpoint,
      });
    } catch (error) {
      await this.updateServerStatus(id, ServerStatus.ERROR, undefined, error.message);
      await this.logError(id, `Failed to start server '${server.name}'`, error);
      throw error;
    }
  }

  /**
   * 停止服务器
   */
  async stopServer(id: string): Promise<void> {
    const server = await this.getServerById(id);
    
    if (server.status === ServerStatus.STOPPED) {
      throw new ConflictException('Server is already stopped');
    }

    if (server.status === ServerStatus.STOPPING) {
      throw new ConflictException('Server is already stopping');
    }

    await this.updateServerStatus(id, ServerStatus.STOPPING);
    
    try {
      const instance = this.serverInstances.get(id);
      if (instance) {
        await this.lifecycleService.stopServer(instance);
        
        // 清理内存中的实例
        this.serverInstances.set(id, {
          id,
          entity: server,
        });
      }

      await this.updateServerStatus(id, ServerStatus.STOPPED);
      await this.logInfo(id, `Server '${server.name}' stopped successfully`);
      
      this.eventEmitter.emit('server.stopped', {
        serverId: id,
        serverName: server.name,
      });
    } catch (error) {
      await this.updateServerStatus(id, ServerStatus.ERROR, undefined, error.message);
      await this.logError(id, `Failed to stop server '${server.name}'`, error);
      throw error;
    }
  }

  /**
   * 重启服务器
   */
  async restartServer(id: string): Promise<void> {
    const server = await this.getServerById(id);
    
    if (server.status === ServerStatus.RUNNING) {
      await this.stopServer(id);
    }
    
    await this.startServer(id);
  }

  /**
   * 获取服务器实例
   */
  getServerInstance(id: string): ServerInstance | undefined {
    return this.serverInstances.get(id);
  }

  /**
   * 获取所有运行中的服务器实例
   */
  getRunningInstances(): ServerInstance[] {
    return Array.from(this.serverInstances.values()).filter(
      instance => instance.entity.status === ServerStatus.RUNNING
    );
  }

  /**
   * 更新服务器状态
   */
  private async updateServerStatus(
    id: string,
    status: ServerStatus,
    endpoint?: string,
    errorMessage?: string
  ): Promise<void> {
    await this.serverRepository.update(id, {
      status,
      endpoint,
      errorMessage,
      healthy: status === ServerStatus.RUNNING,
      lastHealthCheck: new Date(),
    });

    // 更新内存中的实例
    const instance = this.serverInstances.get(id);
    if (instance) {
      instance.entity.status = status;
      instance.entity.endpoint = endpoint;
      instance.entity.errorMessage = errorMessage;
      instance.entity.healthy = status === ServerStatus.RUNNING;
      instance.entity.lastHealthCheck = new Date();
    }
  }

  /**
   * 查找可用端口
   */
  private async findAvailablePort(startPort: number = 3322): Promise<number> {
    for (let port = startPort; port < startPort + 1000; port++) {
      const existingServer = await this.serverRepository.findOne({
        where: { port, status: ServerStatus.RUNNING },
      });
      
      if (!existingServer) {
        return port;
      }
    }
    
    throw new Error('No available ports found');
  }

  /**
   * 记录信息日志
   */
  private async logInfo(serverId: string, message: string, context?: any): Promise<void> {
    await this.logRepository.save({
      level: LogLevel.INFO,
      source: LogSource.SYSTEM,
      message,
      serverId,
      context,
      component: 'ServerManagerService',
    });
  }

  /**
   * 记录错误日志
   */
  private async logError(serverId: string, message: string, error: any, context?: any): Promise<void> {
    await this.logRepository.save({
      level: LogLevel.ERROR,
      source: LogSource.SYSTEM,
      message,
      serverId,
      context: {
        ...context,
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
      },
      component: 'ServerManagerService',
      stackTrace: error.stack,
    });
  }
}