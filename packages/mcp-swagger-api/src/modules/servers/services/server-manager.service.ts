import { Injectable, Logger, NotFoundException, ConflictException, BadRequestException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { v4 as uuidv4 } from 'uuid';

import { MCPServerEntity, ServerStatus, TransportType } from '../../../database/entities/mcp-server.entity';
import { LogEntryEntity, LogLevel, LogSource } from '../../../database/entities/log-entry.entity';
import { ServerLifecycleService } from './server-lifecycle.service';
import { CreateServerDto, UpdateServerDto, ServerQueryDto, ServerResponseDto, PaginatedResponseDto } from '../dto/server.dto';
import { ServerMapper } from '../utils/server-mapper.util';
import { DocumentsService } from '../../documents/services/documents.service';

export interface ServerInstance {
  id: string;
  entity: MCPServerEntity;
  mcpServer?: any; // MCP服务器实例
  httpServer?: any; // HTTP服务器实例
  startTime?: Date;
  lastActivity?: Date;
}

@Injectable()
export class ServerManagerService implements OnModuleInit {
  private readonly logger = new Logger(ServerManagerService.name);
  private readonly serverInstances = new Map<string, ServerInstance>();
  private readonly startingServers = new Set<string>(); // 启动锁机制
  private isInitialized = false;

  constructor(
    @InjectRepository(MCPServerEntity)
    private readonly serverRepository: Repository<MCPServerEntity>,
    @InjectRepository(LogEntryEntity)
    private readonly logRepository: Repository<LogEntryEntity>,
    private readonly lifecycleService: ServerLifecycleService,
    private readonly documentsService: DocumentsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * 模块初始化时调用
   */
  async onModuleInit(): Promise<void> {
    if (!this.isInitialized) {
      this.isInitialized = true;
      await this.initializeExistingServers();
    }
  }

  /**
   * 检查并清理重复的服务器记录
   */
  private async checkAndCleanDuplicateServers(): Promise<void> {
    try {
      const servers = await this.serverRepository.find();
      const serversByName = new Map<string, MCPServerEntity[]>();
      const serversByPort = new Map<number, MCPServerEntity[]>();

      // 按名称和端口分组
      for (const server of servers) {
        // 按名称分组
        if (!serversByName.has(server.name)) {
          serversByName.set(server.name, []);
        }
        serversByName.get(server.name)!.push(server);

        // 按端口分组
        if (!serversByPort.has(server.port)) {
          serversByPort.set(server.port, []);
        }
        serversByPort.get(server.port)!.push(server);
      }

      // 检查重复的服务器名称
      for (const [name, duplicates] of serversByName) {
        if (duplicates.length > 1) {
          this.logger.warn(`Found ${duplicates.length} servers with name '${name}'`);
          // 保留最新的，删除其他的
          const sorted = duplicates.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
          const toKeep = sorted[0];
          const toDelete = sorted.slice(1);
          
          for (const server of toDelete) {
            this.logger.log(`Deleting duplicate server '${server.name}' (ID: ${server.id})`);
            await this.serverRepository.remove(server);
          }
        }
      }

      // 检查重复的端口
      for (const [port, duplicates] of serversByPort) {
        if (duplicates.length > 1) {
          this.logger.warn(`Found ${duplicates.length} servers using port ${port}`);
          // 保留最新的，其他的分配新端口
          const sorted = duplicates.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
          const toKeep = sorted[0];
          const toReassign = sorted.slice(1);
          
          for (const server of toReassign) {
            const newPort = await this.findAvailablePort();
            this.logger.log(`Reassigning server '${server.name}' from port ${port} to ${newPort}`);
            await this.serverRepository.update(server.id, { port: newPort });
          }
        }
      }
    } catch (error) {
      this.logger.error('Failed to check and clean duplicate servers:', error);
    }
  }

  /**
   * 初始化时加载现有服务器
   */
  private async initializeExistingServers(): Promise<void> {
    try {
      // 首先检查并清理重复的服务器记录
      await this.checkAndCleanDuplicateServers();
      
      const servers = await this.serverRepository.find({
        where: { autoStart: true },
      });

      this.logger.log(`Found ${servers.length} servers with auto-start enabled`);

      // 用于跟踪已占用的端口
      const usedPorts = new Set<number>();
      // 用于跟踪已启动的服务器名称
      const startedServers = new Set<string>();

      for (const server of servers) {
        // 检查是否已经在启动过程中
        if (this.startingServers.has(server.id)) {
          this.logger.warn(`Server '${server.name}' is already starting, skipping`);
          continue;
        }

        // 重置状态，因为应用重启后服务器实际上已停止
        if (server.status === ServerStatus.RUNNING || server.status === ServerStatus.STARTING) {
          await this.updateServerStatus(server.id, ServerStatus.STOPPED);
          // 更新本地实体状态
          server.status = ServerStatus.STOPPED;
        }
        
        // 创建服务器实例记录
        this.serverInstances.set(server.id, {
          id: server.id,
          entity: server,
        });

        // 检查是否已经启动过同名服务器
        if (startedServers.has(server.name)) {
          this.logger.warn(`Skipping duplicate server '${server.name}' - already started`);
          continue;
        }

        // 检查端口是否已被占用（数据库层面）
        if (usedPorts.has(server.port)) {
          this.logger.warn(`Skipping server '${server.name}' - port ${server.port} already tracked as used`);
          await this.logError(server.id, `Auto-start skipped: port ${server.port} already tracked as used`, new Error('Port conflict'));
          continue;
        }

        // 检查端口是否真正可用（系统层面）
        const isPortAvailable = await this.lifecycleService.isPortAvailable(server.port);
        if (!isPortAvailable) {
          this.logger.warn(`Skipping server '${server.name}' - port ${server.port} is not available on system`);
          await this.logError(server.id, `Auto-start skipped: port ${server.port} is not available on system`, new Error('Port not available'));
          usedPorts.add(server.port); // 标记为已占用
          continue;
        }

        // 添加到启动锁
        this.startingServers.add(server.id);

        // 尝试启动服务器
        try {
          this.logger.log(`Starting server '${server.name}' on port ${server.port}`);
          await this.startServer(server.id);
          usedPorts.add(server.port);
          startedServers.add(server.name);
          this.logger.log(`Successfully started server '${server.name}'`);
        } catch (error) {
          this.logger.error(`Failed to auto-start server ${server.name}:`, error);
          await this.logError(server.id, 'Auto-start failed', error);
          
          // 如果是端口冲突错误，记录端口为已占用
          if (error.message && error.message.includes('EADDRINUSE')) {
            usedPorts.add(server.port);
          }
        } finally {
          // 从启动锁中移除
          this.startingServers.delete(server.id);
        }
      }
    } catch (error) {
      this.logger.error('Failed to initialize existing servers:', error);
    }
  }

  /**
   * 创建新的MCP服务器
   */
  async createServer(createDto: CreateServerDto): Promise<ServerResponseDto> {
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

    // 处理 OpenAPI 文档
    let openApiData = createDto.openApiData;
    
    // 如果提供了 openApiDocumentId，从文档服务获取内容（优先级高于直接传入的openApiData）
    if (createDto.config?.openApiDocumentId) {
      try {
        // 由于当前没有用户认证，暂时跳过用户验证，直接通过ID获取文档
        const document = await this.documentsService.findOne(null, createDto.config.openApiDocumentId);
        openApiData = JSON.parse(document.content);
        this.logger.log(`Retrieved OpenAPI document ${createDto.config.openApiDocumentId} for server ${createDto.name}`);
      } catch (error) {
        this.logger.error(`Failed to retrieve OpenAPI document ${createDto.config.openApiDocumentId}: ${error.message}`);
        throw new BadRequestException(`OpenAPI document with ID ${createDto.config.openApiDocumentId} not found or invalid`);
      }
    }

    // 检查是否有有效的OpenAPI数据
    if (!openApiData || Object.keys(openApiData).length === 0) {
      throw new BadRequestException('OpenAPI data is required. Please provide either openApiData or openApiDocumentId in config.');
    }

    // 验证OpenAPI数据（无论是直接传入还是从数据库获取）
    try {
      await this.lifecycleService.validateOpenApiData(openApiData);
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
      openApiData: openApiData,
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

    return ServerMapper.toResponseDto(savedServer);
  }

  /**
   * 获取所有服务器
   */
  async getAllServers(query?: ServerQueryDto): Promise<PaginatedResponseDto<ServerResponseDto>> {
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
      queryBuilder.andWhere('server.tags ?| :tags', { tags });
    }

    // 分页
    const offset = (page - 1) * limit;
    queryBuilder.skip(offset).take(limit);

    // 排序
    queryBuilder.orderBy('server.updatedAt', 'DESC');

    const [servers, total] = await queryBuilder.getManyAndCount();

    return ServerMapper.toPaginatedResponseDto(servers, total, page, limit);
  }

  /**
   * 根据ID获取服务器
   */
  async getServerById(id: string): Promise<ServerResponseDto> {
    const server = await this.serverRepository.findOne({ where: { id } });
    
    if (!server) {
      throw new NotFoundException(`Server with ID '${id}' not found`);
    }

    return ServerMapper.toResponseDto(server);
  }

  /**
   * 根据ID获取服务器实体（内部使用）
   */
  private async getServerEntityById(id: string): Promise<MCPServerEntity> {
    const server = await this.serverRepository.findOne({ where: { id } });
    
    if (!server) {
      throw new NotFoundException(`Server with ID '${id}' not found`);
    }

    return server;
  }

  /**
   * 更新服务器配置
   */
  async updateServer(id: string, updateDto: UpdateServerDto): Promise<ServerResponseDto> {
    const server = await this.getServerEntityById(id);

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

    return ServerMapper.toResponseDto(updatedServer);
  }

  /**
   * 删除服务器
   */
  async deleteServer(id: string): Promise<void> {
    const server = await this.getServerEntityById(id);

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
    const server = await this.getServerEntityById(id);
    
    // 检查启动锁
    if (this.startingServers.has(id)) {
      throw new ConflictException('Server is already in the process of starting');
    }
    
    if (server.status === ServerStatus.RUNNING) {
      throw new ConflictException('Server is already running');
    }

    if (server.status === ServerStatus.STARTING) {
      throw new ConflictException('Server is already starting');
    }

    // 检查端口是否真正可用
    const isPortAvailable = await this.lifecycleService.isPortAvailable(server.port);
    if (!isPortAvailable) {
      throw new ConflictException(`Port ${server.port} is not available`);
    }

    // 添加到启动锁
    this.startingServers.add(id);

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
    } finally {
      // 从启动锁中移除
      this.startingServers.delete(id);
    }
  }

  /**
   * 停止服务器
   */
  async stopServer(id: string): Promise<void> {
    const server = await this.getServerEntityById(id);
    
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
    const server = await this.getServerEntityById(id);
    
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