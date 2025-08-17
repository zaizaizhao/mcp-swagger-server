import { Injectable, Logger, NotFoundException, ConflictException, BadRequestException, OnModuleInit, OnApplicationShutdown } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { v4 as uuidv4 } from 'uuid';

import { MCPServerEntity, ServerStatus, TransportType } from '../../../database/entities/mcp-server.entity';
import { LogEntryEntity, LogLevel, LogSource } from '../../../database/entities/log-entry.entity';
import { ServerLifecycleService } from './server-lifecycle.service';
import { ProcessManagerService } from './process-manager.service';
import { ProcessHealthService } from './process-health.service';
import { ProcessErrorHandlerService } from './process-error-handler.service';
import { CreateServerDto, UpdateServerDto, ServerQueryDto, ServerResponseDto, PaginatedResponseDto } from '../dto/server.dto';
import { ServerMapper } from '../utils/server-mapper.util';
import { DocumentsService } from '../../documents/services/documents.service';
import { SystemLogService } from './system-log.service';
import { SystemLogEventType, SystemLogLevel } from '../../../database/entities/system-log.entity';
import {
  ProcessStatus,
  ProcessInfo,
  ProcessEvent,
  ProcessErrorEvent
} from '../interfaces/process.interface';

export interface ServerInstance {
  id: string;
  entity: MCPServerEntity;
  mcpServer?: any; // MCP服务器实例
  httpServer?: any; // HTTP服务器实例
  startTime?: Date;
  lastActivity?: Date;
}

@Injectable()
export class ServerManagerService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(ServerManagerService.name);
  private readonly serverInstances = new Map<string, ServerInstance>();
  private readonly startingServers = new Set<string>(); // 启动锁机制
  
  // 防止并发初始化的锁机制
  private static initializationLock = false;

  constructor(
    @InjectRepository(MCPServerEntity)
    private readonly serverRepository: Repository<MCPServerEntity>,
    @InjectRepository(LogEntryEntity)
    private readonly logRepository: Repository<LogEntryEntity>,
    private readonly lifecycleService: ServerLifecycleService,
    private readonly processManager: ProcessManagerService,
    private readonly processHealth: ProcessHealthService,
    private readonly processErrorHandler: ProcessErrorHandlerService,
    private readonly documentsService: DocumentsService,
    private readonly eventEmitter: EventEmitter2,
    private readonly systemLogService: SystemLogService,
  ) {
    // 监听进程事件
    this.setupProcessEventListeners();
  }

  /**
   * 设置进程事件监听器
   */
  private setupProcessEventListeners(): void {
    // 监听进程启动事件
    this.eventEmitter.on('process.started', async (event: ProcessEvent) => {
      await this.handleProcessStarted(event);
    });

    // 监听进程停止事件
    this.eventEmitter.on('process.stopped', async (event: ProcessEvent) => {
      await this.handleProcessStopped(event);
    });

    // 监听进程错误事件
    this.eventEmitter.on('process.error', async (event: ProcessErrorEvent) => {
      await this.handleProcessError(event);
    });

    // 监听进程重启事件
    this.eventEmitter.on('process.restart_success', async (event: ProcessEvent) => {
      await this.handleProcessRestarted(event);
    });

    // 监听健康检查失败事件
    this.eventEmitter.on('process.health_check_failed', async (event: ProcessEvent) => {
      await this.handleHealthCheckFailed(event);
    });
  }

  /**
   * 处理进程启动事件（CLI spawn模式）
   */
  private async handleProcessStarted(event: ProcessEvent): Promise<void> {
    try {
      await this.updateServerStatus(event.processId, ServerStatus.RUNNING);
      await this.logInfo(event.processId, `Process started successfully (PID: ${event.data?.pid})`);
    } catch (error) {
      this.logger.error(`Failed to handle process started event for ${event.processId}:`, error);
    }
  }

  /**
   * 处理进程停止事件（CLI spawn模式）
   */
  private async handleProcessStopped(event: ProcessEvent): Promise<void> {
    try {
      await this.updateServerStatus(event.processId, ServerStatus.STOPPED);
      await this.logInfo(event.processId, 'Process stopped');
    } catch (error) {
      this.logger.error(`Failed to handle process stopped event for ${event.processId}:`, error);
    }
  }

  /**
   * 处理进程错误事件（CLI spawn模式）
   */
  private async handleProcessError(event: ProcessErrorEvent): Promise<void> {
    try {
      await this.updateServerStatus(event.processId, ServerStatus.ERROR);
      await this.logError(event.processId, `Process error: ${event.errorType}`, event.error);
    } catch (error) {
      this.logger.error(`Failed to handle process error event for ${event.processId}:`, error);
    }
  }

  /**
   * 处理进程重启事件（CLI spawn模式）
   */
  private async handleProcessRestarted(event: ProcessEvent): Promise<void> {
    try {
      await this.updateServerStatus(event.processId, ServerStatus.RUNNING);
      await this.logInfo(event.processId, `Process restarted successfully (attempt ${event.data?.attemptNumber})`);
    } catch (error) {
      this.logger.error(`Failed to handle process restarted event for ${event.processId}:`, error);
    }
  }

  /**
   * 处理健康检查失败事件（CLI spawn模式）
   */
  private async handleHealthCheckFailed(event: ProcessEvent): Promise<void> {
    try {
      // 更新服务器健康状态
      const server = await this.serverRepository.findOne({ where: { id: event.processId } });
      if (server) {
        await this.serverRepository.update(event.processId, { healthy: false });
      }
      
      await this.logError(event.processId, 'Health check failed', event.data?.error || 'Unknown health check error');
      
      // 发送事件通知
      this.eventEmitter.emit('server.health.changed', {
        serverId: event.processId,
        healthy: false,
        error: event.data?.error,
        timestamp: new Date()
      });
    } catch (error) {
      this.logger.error(`Failed to handle health check failed event for ${event.processId}:`, error);
    }
  }

  /**
   * 模块初始化时调用
   */
  async onModuleInit(): Promise<void> {
    // 防止并发初始化
    if (ServerManagerService.initializationLock) {
      this.logger.warn('ServerManagerService initialization already in progress, waiting...');
      // 等待其他初始化完成
      let attempts = 0;
      while (ServerManagerService.initializationLock && attempts < 50) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }
      this.logger.log('ServerManagerService initialization wait completed');
      return;
    }

    ServerManagerService.initializationLock = true;
    this.logger.log('Starting ServerManagerService initialization...');
    
    try {
      await this.initializeExistingServers();
      this.logger.log('ServerManagerService initialization completed successfully');
    } catch (error) {
      this.logger.error('ServerManagerService initialization failed:', error);
      throw error;
    } finally {
      ServerManagerService.initializationLock = false;
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
    this.logger.log(`🚀 [DEBUG] Starting initializeExistingServers process`);
    try {
      // 首先检查并清理重复的服务器记录
      await this.checkAndCleanDuplicateServers();
      
      const servers = await this.serverRepository.find({
        where: { autoStart: true },
      });

      this.logger.log(`📊 [DEBUG] Found ${servers.length} servers with auto-start enabled`);
      
      // 打印每个服务器的详细信息
      servers.forEach(server => {
        this.logger.log(`📋 [DEBUG] Server found - ID: ${server.id}, Name: ${server.name}, Status: ${server.status}, Port: ${server.port}, AutoStart: ${server.autoStart}`);
      });

      // 用于跟踪已占用的端口
      const usedPorts = new Set<number>();
      // 用于跟踪已启动的服务器名称
      const startedServers = new Set<string>();

      for (const server of servers) {
        this.logger.log(`🔄 [DEBUG] Processing server: ${server.name} (${server.id})`);
        
        // 检查是否已经在启动过程中
        if (this.startingServers.has(server.id)) {
          this.logger.warn(`⚠️ [DEBUG] Server '${server.name}' is already starting, skipping`);
          continue;
        }

        // 重置状态，因为应用重启后服务器实际上已停止
        if (server.status === ServerStatus.RUNNING || server.status === ServerStatus.STARTING) {
          this.logger.log(`🔄 [DEBUG] Resetting server '${server.name}' status from ${server.status} to STOPPED`);
          await this.updateServerStatus(server.id, ServerStatus.STOPPED);
          // 更新本地实体状态
          server.status = ServerStatus.STOPPED;
          this.logger.log(`✅ [DEBUG] Server '${server.name}' status reset completed`);
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
          await this.logError(server.id, `Auto-start skipped: port ${server.port} already tracked as used`, 'Port conflict');
          continue;
        }

        // 检查端口是否真正可用（系统层面）
        const isPortAvailable = await this.lifecycleService.isPortAvailable(server.port);
        if (!isPortAvailable) {
          this.logger.warn(`Skipping server '${server.name}' - port ${server.port} is not available on system`);
          await this.logError(server.id, `Auto-start skipped: port ${server.port} is not available on system`, 'Port not available');
          usedPorts.add(server.port); // 标记为已占用
          continue;
        }

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
      
      // 记录系统日志
      try {
        await this.systemLogService.createLog({
          serverId: id,
          eventType: SystemLogEventType.SERVER_STARTED,
          description: `Server '${server.name}' started successfully on ${instance.endpoint}`,
          level: SystemLogLevel.INFO,
          details: {
            serverName: server.name,
            endpoint: instance.endpoint,
            port: server.port,
            transport: server.transport,
          },
        });
      } catch (logError) {
        this.logger.error(`Failed to create system log for server start: ${logError.message}`);
      }
      
      this.eventEmitter.emit('server.started', {
        serverId: id,
        serverName: server.name,
        endpoint: instance.endpoint,
      });
    } catch (error) {
      await this.updateServerStatus(id, ServerStatus.ERROR, undefined, error.message);
      await this.logError(id, `Failed to start server '${server.name}'`, error);
      
      // 记录系统日志
      try {
        await this.systemLogService.createLog({
          serverId: id,
          eventType: SystemLogEventType.SERVER_STARTED,
          description: `Failed to start server '${server.name}': ${error.message}`,
          level: SystemLogLevel.ERROR,
          details: {
            serverName: server.name,
            error: error.message,
            port: server.port,
            transport: server.transport,
          },
        });
      } catch (logError) {
        this.logger.error(`Failed to create system log for server start error: ${logError.message}`);
      }
      
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
    this.logger.log(`🛑 [DEBUG] stopServer called for ID: ${id}`);
    
    // 先调用调试方法查看当前状态
    await this.debugGetAllServerStates();
    
    const server = await this.getServerEntityById(id);
    this.logger.log(`🛑 [DEBUG] Found server in database: ${server.name} - Status: ${server.status}`);
    
    if (server.status === ServerStatus.STOPPED) {
      this.logger.warn(`🛑 [DEBUG] Server ${server.name} is already stopped`);
      throw new ConflictException('Server is already stopped');
    }

    if (server.status === ServerStatus.STOPPING) {
      this.logger.warn(`🛑 [DEBUG] Server ${server.name} is already stopping`);
      throw new ConflictException('Server is already stopping');
    }

    this.logger.log(`🛑 [DEBUG] Updating server ${server.name} status to STOPPING`);
    await this.updateServerStatus(id, ServerStatus.STOPPING);
    
    try {
      const instance = this.serverInstances.get(id);
      this.logger.log(`🛑 [DEBUG] Memory instance found: ${!!instance}`);
      
      if (instance) {
        this.logger.log(`🛑 [DEBUG] Instance details - hasHttpServer: ${!!instance.httpServer}, hasMcpServer: ${!!instance.mcpServer}`);
        this.logger.log(`🛑 [DEBUG] Calling lifecycleService.stopServer for ${server.name}`);
        
        await this.lifecycleService.stopServer(instance);
        
        this.logger.log(`🛑 [DEBUG] lifecycleService.stopServer completed, cleaning up memory instance`);
        // 清理内存中的实例
        this.serverInstances.set(id, {
          id,
          entity: server,
        });
      } else {
        this.logger.warn(`🛑 [DEBUG] No memory instance found for server ${server.name}, but continuing with status update`);
      }

      this.logger.log(`🛑 [DEBUG] Updating server ${server.name} status to STOPPED`);
      await this.updateServerStatus(id, ServerStatus.STOPPED);
      await this.logInfo(id, `Server '${server.name}' stopped successfully`);
      
      // 记录系统日志
      try {
        await this.systemLogService.createLog({
          serverId: id,
          eventType: SystemLogEventType.SERVER_STOPPED,
          description: `Server '${server.name}' stopped successfully`,
          level: SystemLogLevel.INFO,
          details: {
            serverName: server.name,
            port: server.port,
            transport: server.transport,
          },
        });
      } catch (logError) {
        this.logger.error(`Failed to create system log for server stop: ${logError.message}`);
      }
      
      this.logger.log(`🛑 [DEBUG] Emitting server.stopped event for ${server.name}`);
      this.eventEmitter.emit('server.stopped', {
        serverId: id,
        serverName: server.name,
      });
      
      this.logger.log(`🛑 [DEBUG] stopServer completed successfully for ${server.name}`);
    } catch (error) {
      this.logger.error(`🛑 [DEBUG] stopServer failed for ${server.name}:`, error);
      await this.updateServerStatus(id, ServerStatus.ERROR, undefined, error.message);
      await this.logError(id, `Failed to stop server '${server.name}'`, error);
      
      // 记录系统日志
      try {
        await this.systemLogService.createLog({
          serverId: id,
          eventType: SystemLogEventType.SERVER_STOPPED,
          description: `Failed to stop server '${server.name}': ${error.message}`,
          level: SystemLogLevel.ERROR,
          details: {
            serverName: server.name,
            error: error.message,
            port: server.port,
            transport: server.transport,
          },
        });
      } catch (logError) {
        this.logger.error(`Failed to create system log for server stop error: ${logError.message}`);
      }
      
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
    
    // 记录系统日志
    try {
      await this.systemLogService.createLog({
        serverId: id,
        eventType: SystemLogEventType.SERVER_RESTARTED,
        description: `Server '${server.name}' restarted successfully`,
        level: SystemLogLevel.INFO,
        details: {
            serverName: server.name,
            port: server.port,
            transport: server.transport,
          },
      });
    } catch (logError) {
      this.logger.error(`Failed to create system log for server restart: ${logError.message}`);
    }
    
    this.logger.log(`Server '${server.name}' restarted successfully`);
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
    const instances = Array.from(this.serverInstances.values()).filter(
      instance => instance.entity.status === ServerStatus.RUNNING
    );
    this.logger.log(`🔍 [DEBUG] getRunningInstances found ${instances.length} running servers`);
    instances.forEach(instance => {
      this.logger.log(`🔍 [DEBUG] Running server: ${instance.entity.name} (${instance.id}) - Status: ${instance.entity.status}`);
    });
    return instances;
  }

  /**
   * 调试方法：获取当前所有服务器状态
   */
  async debugGetAllServerStates(): Promise<any> {
    this.logger.log('🔍 [DEBUG] Starting debugGetAllServerStates');
    
    // 获取数据库中的所有服务器
    const dbServers = await this.serverRepository.find();
    this.logger.log(`🔍 [DEBUG] Database has ${dbServers.length} servers`);
    
    // 获取内存中的所有实例
    const memoryInstances = Array.from(this.serverInstances.entries());
    this.logger.log(`🔍 [DEBUG] Memory has ${memoryInstances.length} instances`);
    
    const debugInfo = {
      databaseServers: dbServers.map(server => ({
        id: server.id,
        name: server.name,
        status: server.status,
        healthy: server.healthy,
        endpoint: server.endpoint,
        port: server.port
      })),
      memoryInstances: memoryInstances.map(([id, instance]) => ({
        id,
        name: instance.entity.name,
        status: instance.entity.status,
        healthy: instance.entity.healthy,
        endpoint: instance.entity.endpoint,
        hasHttpServer: !!instance.httpServer,
        hasMcpServer: !!instance.mcpServer
      })),
      runningCount: this.getRunningInstances().length
    };
    
    this.logger.log('🔍 [DEBUG] Complete debug info:', JSON.stringify(debugInfo, null, 2));
    return debugInfo;
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
    this.logger.log(`🔄 [DEBUG] Updating server status - ID: ${id}, Status: ${status}, Endpoint: ${endpoint || 'N/A'}, Error: ${errorMessage || 'N/A'}`);
    
    try {
      // 获取当前服务器信息以更新metrics
      const currentServer = await this.serverRepository.findOne({ where: { id } });
      if (!currentServer) {
        throw new Error(`Server ${id} not found`);
      }

      // 准备更新的metrics
      let updatedMetrics = currentServer.metrics || {};
      
      // 如果状态变为RUNNING，记录启动时间
      if (status === ServerStatus.RUNNING && currentServer.status !== ServerStatus.RUNNING) {
        updatedMetrics = {
          ...updatedMetrics,
          startedAt: new Date(),
        };
        this.logger.log(`🚀 [DEBUG] Recording server start time for ${id}`);
      }
      
      // 如果状态变为STOPPED或ERROR，清除启动时间
      if ((status === ServerStatus.STOPPED || status === ServerStatus.ERROR) && updatedMetrics.startedAt) {
        updatedMetrics = {
          ...updatedMetrics,
          startedAt: undefined,
        };
        this.logger.log(`🛑 [DEBUG] Clearing server start time for ${id}`);
      }

      // 更新数据库
      const updateResult = await this.serverRepository.update(id, {
        status,
        endpoint,
        errorMessage,
        healthy: status === ServerStatus.RUNNING,
        lastHealthCheck: new Date(),
        metrics: updatedMetrics,
      });
      
      this.logger.log(`✅ [DEBUG] Database update result - Affected rows: ${updateResult.affected}`);
      
      // 验证数据库更新
      const updatedServer = await this.serverRepository.findOne({ where: { id } });
      if (updatedServer) {
        this.logger.log(`📊 [DEBUG] Database verification - Server ${id} status is now: ${updatedServer.status}`);
      } else {
        this.logger.error(`❌ [DEBUG] Server ${id} not found in database after update`);
      }

      // 更新内存中的实例
      const instance = this.serverInstances.get(id);
      if (instance) {
        instance.entity.status = status;
        instance.entity.endpoint = endpoint;
        instance.entity.errorMessage = errorMessage;
        instance.entity.healthy = status === ServerStatus.RUNNING;
        instance.entity.lastHealthCheck = new Date();
        instance.entity.metrics = updatedMetrics;
        this.logger.log(`💾 [DEBUG] Memory instance updated for server ${id}`);
      } else {
        this.logger.warn(`⚠️ [DEBUG] No memory instance found for server ${id}`);
      }
    } catch (error) {
      this.logger.error(`❌ [DEBUG] Failed to update server status for ${id}:`, error);
      throw error;
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

  /**
   * 应用关闭时调用，停止所有运行中的服务器
   */
  async onApplicationShutdown(signal?: string): Promise<void> {
    this.logger.log(`Application shutdown initiated with signal: ${signal || 'unknown'}`);
    
    try {
      // 获取所有运行中的服务器实例
      const runningInstances = this.getRunningInstances();
      
      if (runningInstances.length === 0) {
        this.logger.log('No running servers to stop');
        return;
      }

      this.logger.log(`Stopping ${runningInstances.length} running servers...`);
      
      // 并行停止所有运行中的服务器
      const stopPromises = runningInstances.map(async (instance) => {
        try {
          this.logger.log(`Stopping server: ${instance.entity.name} (${instance.id})`);
          
          // 更新状态为停止中
          await this.updateServerStatus(instance.id, ServerStatus.STOPPING);
          
          // 停止服务器
          if (instance.mcpServer || instance.httpServer) {
            await this.lifecycleService.stopServer(instance);
          }
          
          // 更新状态为已停止
          await this.updateServerStatus(instance.id, ServerStatus.STOPPED);
          
          // 清理内存中的实例
          this.serverInstances.set(instance.id, {
            id: instance.id,
            entity: instance.entity,
          });
          
          await this.logInfo(instance.id, `Server '${instance.entity.name}' stopped during application shutdown`);
          
          this.logger.log(`Successfully stopped server: ${instance.entity.name} (${instance.id})`);
        } catch (error) {
          this.logger.error(`Failed to stop server ${instance.entity.name} (${instance.id}):`, error);
          
          // 即使停止失败，也要更新状态为错误
          try {
            await this.updateServerStatus(instance.id, ServerStatus.ERROR, undefined, error.message);
            await this.logError(instance.id, `Failed to stop server '${instance.entity.name}' during application shutdown`, error);
          } catch (logError) {
            this.logger.error(`Failed to log error for server ${instance.id}:`, logError);
          }
        }
      });
      
      // 等待所有服务器停止完成（设置超时时间）
      await Promise.allSettled(stopPromises);
      
      this.logger.log('Application shutdown cleanup completed');
    } catch (error) {
      this.logger.error('Error during application shutdown:', error);
    } finally {
      // 重置初始化锁状态，允许下次启动时重新初始化
      ServerManagerService.initializationLock = false;
      this.logger.log('Reset initialization lock state');
    }
  }
}