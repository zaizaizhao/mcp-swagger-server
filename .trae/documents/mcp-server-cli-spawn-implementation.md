# MCP Server CLI Spawn 进程隔离实施方案

## 1. 方案概述

通过直接使用 `spawn` 调用 `mcp-swagger-server` 的 CLI 来实现 MCP 服务器的真正进程隔离。这种方案利用现有的成熟 CLI 接口，避免了创建独立 server.js 脚本的复杂性，是实现进程隔离的最优解决方案。

### 1.1 核心优势
- **零额外开发**：直接使用现有的 CLI，无需创建新的启动脚本
- **功能完整**：CLI 支持所有传输协议（stdio、sse、streamable）和认证方式
- **配置灵活**：支持命令行参数、配置文件、环境变量等多种配置方式
- **稳定可靠**：CLI 已经过充分测试，具备完整的错误处理和重启机制
- **易于维护**：跟随 mcp-swagger-server 版本更新，无需额外维护

## 2. CLI 接口分析

### 2.1 可执行文件位置
```json
// package.json
{
  "bin": {
    "mcp-swagger-server": "./dist/cli.js",
    "mcp-swagger": "./dist/cli.js"
  }
}
```

### 2.2 支持的命令行参数
```bash
# 基础配置
-t, --transport <type>     # 传输协议 (stdio|sse|streamable)
-p, --port <port>         # 服务器端口号
-e, --endpoint <path>     # 自定义端点路径
-o, --openapi <source>    # OpenAPI 数据源 (URL 或文件路径)
-c, --config <file>       # 配置文件路径 (JSON 格式)
--env <file>              # 环境变量文件路径 (.env 格式)

# 认证选项
--auth-type <type>        # 认证类型 (none|bearer)
--bearer-token <token>    # Bearer Token 静态值
--bearer-env <varname>    # Bearer Token 环境变量名

# 自定义请求头
--custom-header <header>  # 自定义请求头 "Key=Value" (可重复)
--custom-headers-config <file>  # 自定义请求头配置文件
--custom-header-env <header>    # 环境变量请求头 (可重复)
--debug-headers           # 启用请求头调试模式

# 高级选项
-w, --watch              # 监控文件变化并自动重载
-m, --managed            # 启用托管模式 (进程管理)
--auto-restart           # 自动重启服务器
--max-retries <num>      # 最大重试次数
--retry-delay <ms>       # 重试延迟 (毫秒)
```

## 3. 技术实施方案

### 3.1 修改 ProcessConfig 接口

```typescript
// src/modules/servers/interfaces/process.interface.ts
export interface ProcessConfig {
  id: string;
  name: string;
  // 修改：使用 CLI 可执行文件路径
  scriptPath: string; // 'mcp-swagger-server' 或完整路径
  // 修改：使用 CLI 参数数组
  args: string[];
  cwd?: string;
  env?: Record<string, string>;
  restartPolicy?: RestartPolicy;
  healthCheck?: {
    enabled: boolean;
    interval: number;
    timeout: number;
    retries: number;
    endpoint?: string; // HTTP 传输协议的健康检查端点
  };
  // 新增：MCP 特定配置
  mcpConfig?: {
    transport: 'stdio' | 'sse' | 'streamable';
    port?: number;
    endpoint?: string;
    openApiSource?: string;
    authConfig?: {
      type: 'none' | 'bearer';
      bearerToken?: string;
      bearerEnv?: string;
    };
    customHeaders?: Record<string, string>;
    watch?: boolean;
    managed?: boolean;
    autoRestart?: boolean;
    maxRetries?: number;
    retryDelay?: number;
  };
}
```

### 3.2 修改 ServerLifecycleService

```typescript
// src/modules/servers/services/server-lifecycle.service.ts
@Injectable()
export class ServerLifecycleService {
  constructor(
    private readonly processManager: ProcessManagerService,
    private readonly processHealth: ProcessHealthService,
    private readonly logger: Logger
  ) {}

  async startServer(serverId: string, config: any): Promise<ServerStartResult> {
    try {
      // 构建 CLI 进程配置
      const processConfig = this.buildCliProcessConfig(serverId, config);
      
      // 启动 CLI 进程
      const processInfo = await this.processManager.startProcess(processConfig);
      
      // 启动健康检查（仅对 HTTP 传输协议）
      if (processConfig.mcpConfig?.transport !== 'stdio') {
        await this.processHealth.startHealthCheck(processInfo.id);
      }
      
      this.logger.log(`MCP Server started via CLI: ${serverId}`);
      
      return {
        success: true,
        processId: processInfo.id,
        pid: processInfo.pid,
        transport: processConfig.mcpConfig?.transport || 'stdio',
        port: processConfig.mcpConfig?.port,
        endpoint: processConfig.mcpConfig?.endpoint
      };
    } catch (error) {
      this.logger.error(`Failed to start MCP Server via CLI: ${error.message}`);
      throw error;
    }
  }

  private buildCliProcessConfig(serverId: string, config: any): ProcessConfig {
    const mcpConfig = config.mcpConfig || {};
    const transport = mcpConfig.transport || 'stdio';
    const port = mcpConfig.port || 3322;
    const endpoint = mcpConfig.endpoint || (transport === 'sse' ? '/sse' : '/mcp');
    
    // 构建 CLI 参数
    const args: string[] = [
      '--transport', transport
    ];
    
    // 添加端口参数（非 stdio 模式）
    if (transport !== 'stdio') {
      args.push('--port', port.toString());
      args.push('--endpoint', endpoint);
    }
    
    // 添加 OpenAPI 数据源
    if (mcpConfig.openApiSource) {
      args.push('--openapi', mcpConfig.openApiSource);
    }
    
    // 添加认证配置
    if (mcpConfig.authConfig) {
      args.push('--auth-type', mcpConfig.authConfig.type);
      if (mcpConfig.authConfig.bearerToken) {
        args.push('--bearer-token', mcpConfig.authConfig.bearerToken);
      }
      if (mcpConfig.authConfig.bearerEnv) {
        args.push('--bearer-env', mcpConfig.authConfig.bearerEnv);
      }
    }
    
    // 添加自定义请求头
    if (mcpConfig.customHeaders) {
      Object.entries(mcpConfig.customHeaders).forEach(([key, value]) => {
        args.push('--custom-header', `${key}=${value}`);
      });
    }
    
    // 添加高级选项
    if (mcpConfig.watch) args.push('--watch');
    if (mcpConfig.managed) args.push('--managed');
    if (mcpConfig.autoRestart) args.push('--auto-restart');
    if (mcpConfig.maxRetries) args.push('--max-retries', mcpConfig.maxRetries.toString());
    if (mcpConfig.retryDelay) args.push('--retry-delay', mcpConfig.retryDelay.toString());
    
    return {
      id: serverId,
      name: `mcp-server-${serverId}`,
      scriptPath: 'mcp-swagger-server', // 使用全局安装的 CLI
      args,
      cwd: process.cwd(),
      env: {
        ...process.env,
        NODE_ENV: 'production'
      },
      restartPolicy: {
        type: 'always',
        maxRetries: mcpConfig.maxRetries || 5,
        delay: mcpConfig.retryDelay || 5000
      },
      healthCheck: transport !== 'stdio' ? {
        enabled: true,
        interval: 30000,
        timeout: 5000,
        retries: 3,
        endpoint: `http://localhost:${port}${endpoint}/health`
      } : { enabled: false, interval: 0, timeout: 0, retries: 0 },
      mcpConfig
    };
  }
}
```

### 3.3 增强 ProcessManagerService

```typescript
// src/modules/servers/services/process-manager.service.ts
@Injectable()
export class ProcessManagerService implements OnModuleDestroy {
  private processes = new Map<string, ProcessInfo>();
  private readonly logger = new Logger(ProcessManagerService.name);

  async startProcess(config: ProcessConfig): Promise<ProcessInfo> {
    try {
      // 检查 CLI 可执行文件
      const cliPath = await this.resolveCLIPath(config.scriptPath);
      
      this.logger.log(`Starting MCP CLI process: ${cliPath} ${config.args.join(' ')}`);
      
      // 启动子进程
      const childProcess = spawn(cliPath, config.args, {
        cwd: config.cwd || process.cwd(),
        env: config.env || process.env,
        stdio: config.mcpConfig?.transport === 'stdio' ? ['pipe', 'pipe', 'pipe'] : 'pipe',
        detached: false
      });
      
      // 创建进程信息
      const processInfo: ProcessInfo = {
        id: config.id,
        name: config.name,
        pid: childProcess.pid!,
        status: 'starting',
        startTime: new Date(),
        config,
        process: childProcess,
        restartCount: 0
      };
      
      // 设置进程监听器
      this.setupProcessListeners(processInfo);
      
      // 保存进程信息
      this.processes.set(config.id, processInfo);
      
      // 保存到数据库
      await this.saveProcessInfo(processInfo);
      
      // 写入 PID 文件
      await this.writePidFile(processInfo);
      
      // 发出进程启动事件
      this.emit('process.started', { processId: config.id, pid: childProcess.pid });
      
      this.logger.log(`MCP CLI process started: ${config.id} (PID: ${childProcess.pid})`);
      
      return processInfo;
    } catch (error) {
      this.logger.error(`Failed to start MCP CLI process: ${error.message}`);
      throw error;
    }
  }
  
  private async resolveCLIPath(scriptPath: string): Promise<string> {
    // 如果是相对路径或命令名，尝试解析
    if (!path.isAbsolute(scriptPath)) {
      // 首先尝试在 node_modules/.bin 中查找
      const localBinPath = path.join(process.cwd(), 'node_modules', '.bin', scriptPath);
      if (await this.fileExists(localBinPath)) {
        return localBinPath;
      }
      
      // 然后尝试全局安装的版本
      try {
        const { execSync } = require('child_process');
        const globalPath = execSync(`which ${scriptPath}`, { encoding: 'utf8' }).trim();
        if (globalPath) {
          return globalPath;
        }
      } catch (error) {
        // 忽略错误，继续下一步
      }
      
      // 最后尝试直接使用 npx
      return `npx ${scriptPath}`;
    }
    
    return scriptPath;
  }
  
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
  
  private setupProcessListeners(processInfo: ProcessInfo): void {
    const { process: childProcess, config } = processInfo;
    
    // 标准输出处理
    if (childProcess.stdout) {
      childProcess.stdout.on('data', (data) => {
        const output = data.toString();
        this.logger.log(`[${processInfo.id}] STDOUT: ${output}`);
        
        // 检测启动成功标志
        if (output.includes('MCP Swagger Server 启动成功') || 
            output.includes('Server started')) {
          processInfo.status = 'running';
          this.emit('process.ready', { processId: processInfo.id });
        }
      });
    }
    
    // 标准错误处理
    if (childProcess.stderr) {
      childProcess.stderr.on('data', (data) => {
        const error = data.toString();
        this.logger.error(`[${processInfo.id}] STDERR: ${error}`);
        this.emit('process.error', { processId: processInfo.id, error });
      });
    }
    
    // 进程退出处理
    childProcess.on('exit', (code, signal) => {
      this.logger.log(`[${processInfo.id}] Process exited with code ${code}, signal ${signal}`);
      processInfo.status = 'stopped';
      processInfo.exitCode = code;
      processInfo.exitSignal = signal;
      
      this.emit('process.exited', { 
        processId: processInfo.id, 
        code, 
        signal 
      });
      
      // 根据重启策略决定是否重启
      if (this.shouldRestart(processInfo)) {
        this.scheduleRestart(processInfo);
      }
    });
    
    // 进程错误处理
    childProcess.on('error', (error) => {
      this.logger.error(`[${processInfo.id}] Process error: ${error.message}`);
      processInfo.status = 'error';
      this.emit('process.error', { processId: processInfo.id, error: error.message });
    });
  }
}
```

### 3.4 数据库实体扩展

```typescript
// src/modules/servers/entities/process-config.entity.ts
@Entity('process_configs')
export class ProcessConfigEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;
  
  @Column()
  name: string;
  
  @Column()
  scriptPath: string; // CLI 路径
  
  @Column('simple-array')
  args: string[]; // CLI 参数数组
  
  @Column({ nullable: true })
  cwd: string;
  
  @Column('simple-json', { nullable: true })
  env: Record<string, string>;
  
  // 新增：MCP 特定配置
  @Column('simple-json', { nullable: true })
  mcpConfig: {
    transport: 'stdio' | 'sse' | 'streamable';
    port?: number;
    endpoint?: string;
    openApiSource?: string;
    authConfig?: {
      type: 'none' | 'bearer';
      bearerToken?: string;
      bearerEnv?: string;
    };
    customHeaders?: Record<string, string>;
    watch?: boolean;
    managed?: boolean;
    autoRestart?: boolean;
    maxRetries?: number;
    retryDelay?: number;
  };
  
  @CreateDateColumn()
  createdAt: Date;
  
  @UpdateDateColumn()
  updatedAt: Date;
}
```

## 4. 配置示例

### 4.1 STDIO 模式配置
```typescript
const stdioConfig: ProcessConfig = {
  id: 'mcp-server-stdio-1',
  name: 'MCP Server STDIO',
  scriptPath: 'mcp-swagger-server',
  args: [
    '--transport', 'stdio',
    '--openapi', 'https://petstore.swagger.io/v2/swagger.json',
    '--auth-type', 'bearer',
    '--bearer-env', 'API_TOKEN'
  ],
  mcpConfig: {
    transport: 'stdio',
    openApiSource: 'https://petstore.swagger.io/v2/swagger.json',
    authConfig: {
      type: 'bearer',
      bearerEnv: 'API_TOKEN'
    }
  }
};
```

### 4.2 Streamable 模式配置
```typescript
const streamableConfig: ProcessConfig = {
  id: 'mcp-server-streamable-1',
  name: 'MCP Server Streamable',
  scriptPath: 'mcp-swagger-server',
  args: [
    '--transport', 'streamable',
    '--port', '3322',
    '--endpoint', '/mcp',
    '--openapi', './openapi.json',
    '--custom-header', 'X-Client-ID=my-app',
    '--watch',
    '--managed'
  ],
  mcpConfig: {
    transport: 'streamable',
    port: 3322,
    endpoint: '/mcp',
    openApiSource: './openapi.json',
    customHeaders: {
      'X-Client-ID': 'my-app'
    },
    watch: true,
    managed: true
  },
  healthCheck: {
    enabled: true,
    interval: 30000,
    timeout: 5000,
    retries: 3,
    endpoint: 'http://localhost:3322/mcp/health'
  }
};
```

### 4.3 SSE 模式配置
```typescript
const sseConfig: ProcessConfig = {
  id: 'mcp-server-sse-1',
  name: 'MCP Server SSE',
  scriptPath: 'mcp-swagger-server',
  args: [
    '--transport', 'sse',
    '--port', '3323',
    '--endpoint', '/sse',
    '--config', './mcp-config.json',
    '--auto-restart',
    '--max-retries', '10'
  ],
  mcpConfig: {
    transport: 'sse',
    port: 3323,
    endpoint: '/sse',
    autoRestart: true,
    maxRetries: 10
  }
};
```

## 5. 健康检查增强

### 5.1 HTTP 传输协议健康检查
```typescript
// src/modules/servers/services/process-health.service.ts
@Injectable()
export class ProcessHealthService {
  async checkHealth(processId: string): Promise<HealthCheckResult> {
    const processInfo = await this.getProcessInfo(processId);
    if (!processInfo) {
      return { healthy: false, error: 'Process not found' };
    }
    
    const { mcpConfig } = processInfo.config;
    
    // STDIO 模式：检查进程是否运行
    if (mcpConfig?.transport === 'stdio') {
      return this.checkProcessRunning(processInfo);
    }
    
    // HTTP 模式：检查端点响应
    if (mcpConfig?.transport === 'sse' || mcpConfig?.transport === 'streamable') {
      return this.checkHttpEndpoint(processInfo);
    }
    
    return { healthy: false, error: 'Unknown transport type' };
  }
  
  private async checkHttpEndpoint(processInfo: ProcessInfo): Promise<HealthCheckResult> {
    const { mcpConfig } = processInfo.config;
    const port = mcpConfig?.port || 3322;
    const endpoint = mcpConfig?.endpoint || '/mcp';
    const healthUrl = `http://localhost:${port}${endpoint}`;
    
    try {
      const response = await axios.get(healthUrl, {
        timeout: 5000,
        validateStatus: (status) => status < 500
      });
      
      return {
        healthy: true,
        responseTime: response.headers['x-response-time'],
        status: response.status,
        data: response.data
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        lastCheck: new Date()
      };
    }
  }
}
```

## 6. 部署和运维

### 6.1 依赖安装
```bash
# 全局安装 mcp-swagger-server
npm install -g mcp-swagger-server

# 或在项目中安装
npm install mcp-swagger-server
```

### 6.2 环境变量配置
```bash
# .env
API_TOKEN=your-bearer-token
OPENAPI_URL=https://api.example.com/openapi.json
MCP_PORT=3322
MCP_TRANSPORT=streamable
```

### 6.3 监控和日志
```typescript
// 进程监控
const processMonitor = {
  async getProcessMetrics(processId: string) {
    const processInfo = await this.processManager.getProcessInfo(processId);
    if (!processInfo?.process) return null;
    
    return {
      pid: processInfo.pid,
      uptime: Date.now() - processInfo.startTime.getTime(),
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      status: processInfo.status,
      restartCount: processInfo.restartCount
    };
  }
};
```

## 7. 优势分析

### 7.1 相比独立 server.js 脚本的优势

| 方面 | CLI Spawn 方案 | 独立 server.js 脚本 |
|------|----------------|---------------------|
| **开发成本** | 零开发，直接使用 | 需要创建和维护脚本 |
| **功能完整性** | 100% CLI 功能 | 需要重新实现功能 |
| **稳定性** | 经过充分测试 | 需要自行测试 |
| **维护成本** | 跟随版本自动更新 | 需要手动同步更新 |
| **配置灵活性** | 支持所有 CLI 选项 | 需要自行实现配置 |
| **错误处理** | 内置完整错误处理 | 需要自行实现 |
| **重启机制** | 内置自动重启 | 需要自行实现 |
| **监控支持** | 内置监控和日志 | 需要自行实现 |

### 7.2 技术优势
- **进程隔离**：真正的独立进程，完全隔离内存和资源
- **故障隔离**：单个 MCP 服务器崩溃不影响主应用
- **资源管理**：独立的 CPU 和内存使用，便于监控和限制
- **版本兼容**：支持不同版本的 mcp-swagger-server
- **配置隔离**：每个进程有独立的配置和环境变量

### 7.3 运维优势
- **简化部署**：无需额外的启动脚本
- **标准化管理**：使用标准的进程管理工具
- **日志集中**：统一的日志格式和输出
- **监控集成**：易于集成到现有监控系统
- **故障排查**：清晰的进程边界，便于问题定位

## 8. 实施步骤

1. **安装依赖**：确保 mcp-swagger-server 已安装
2. **修改接口**：更新 ProcessConfig 接口定义
3. **更新服务**：修改 ServerLifecycleService 和 ProcessManagerService
4. **扩展实体**：更新数据库实体类
5. **增强健康检查**：实现 HTTP 端点健康检查
6. **测试验证**：全面测试各种传输协议
7. **部署上线**：逐步替换现有实现

## 9. 总结

通过直接使用 spawn 调用 mcp-swagger-server 的 CLI，我们可以以最小的开发成本实现真正的 MCP 服务器进程隔离。这种方案不仅技术上更加可靠，而且维护成本更低，是实现进程隔离的最佳选择。