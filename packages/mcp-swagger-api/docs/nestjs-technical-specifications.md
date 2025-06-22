# NestJS 实施技术规范

## 🎯 项目规格

### 基本信息
- **项目名称**: MCP Swagger API Server
- **技术栈**: NestJS + TypeScript + pnpm
- **运行环境**: Node.js 18+
- **端口配置**: 3001 (API服务) + 3322 (MCP协议)
- **开发模式**: Monorepo集成

### 依赖版本规范
```json
{
  "dependencies": {
    "@nestjs/common": "^10.0.0",
    "@nestjs/core": "^10.0.0",
    "@nestjs/platform-express": "^10.0.0",
    "@nestjs/config": "^3.0.0",
    "@nestjs/swagger": "^7.0.0",
    "@nestjs/terminus": "^10.0.0",
    "class-validator": "^0.14.0",
    "class-transformer": "^0.5.1",
    "cors": "^2.8.5",
    "helmet": "^7.0.0",
    "compression": "^1.7.4"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.0.0",
    "@nestjs/testing": "^10.0.0",
    "@types/express": "^4.17.17",
    "jest": "^29.5.0",
    "supertest": "^6.3.0"
  }
}
```

## 🏗️ 架构设计规范

### 模块化架构
```typescript
// 核心模块结构
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    MCPModule,
    OpenAPIModule,
    HealthModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_GUARD,
      useClass: MCPSessionGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: MCPExceptionFilter,
    },
  ],
})
export class AppModule {}
```

### 服务层设计模式
```typescript
// 服务接口定义
export interface IMCPService {
  handleRequest(request: MCPRequest, sessionId?: string): Promise<MCPResponse>;
  getServerStatus(): Promise<ServerStatus>;
  configureDynamicTools(config: ToolConfiguration): Promise<ConfigResult>;
}

// 服务实现
@Injectable()
export class MCPService implements IMCPService {
  constructor(
    private readonly dynamicServerService: DynamicServerService,
    private readonly logger: Logger
  ) {}
  
  async handleRequest(request: MCPRequest, sessionId?: string): Promise<MCPResponse> {
    // 实现细节
  }
}
```

## 📋 API 接口规范

### RESTful API 设计

#### 1. OpenAPI 配置接口
```typescript
@ApiTags('OpenAPI Configuration')
@Controller('api/openapi')
export class OpenAPIController {
  
  @Post('configure')
  @ApiOperation({ summary: '配置OpenAPI规范' })
  @ApiBody({ type: ConfigureOpenAPIDto })
  @ApiResponse({ status: 200, type: ConfigureResultDto })
  async configure(@Body() dto: ConfigureOpenAPIDto): Promise<ApiResponse<ConfigureResultDto>> {
    // 实现逻辑
  }
  
  @Get('status')
  @ApiOperation({ summary: '获取配置状态' })
  @ApiResponse({ status: 200, type: ConfigStatusDto })
  async getStatus(): Promise<ApiResponse<ConfigStatusDto>> {
    // 实现逻辑
  }
  
  @Get('tools')
  @ApiOperation({ summary: '获取工具列表' })
  @ApiResponse({ status: 200, type: ToolListDto })
  async getTools(): Promise<ApiResponse<ToolListDto>> {
    // 实现逻辑
  }
}
```

#### 2. MCP 协议接口
```typescript
@ApiTags('MCP Protocol')
@Controller('mcp')
@UseGuards(MCPSessionGuard)
export class MCPController {
  
  @Post()
  @ApiOperation({ summary: '处理MCP协议请求' })
  @ApiBody({ type: MCPRequestDto })
  @ApiResponse({ status: 200, type: MCPResponseDto })
  async handleMCP(
    @Body() request: MCPRequestDto,
    @Headers('mcp-session-id') sessionId?: string
  ): Promise<MCPResponseDto> {
    // 实现逻辑
  }
}
```

### DTO 验证规范
```typescript
// 请求DTO
export class ConfigureOpenAPIDto {
  @ApiProperty({ description: '输入源配置' })
  @IsObject()
  @ValidateNested()
  @Type(() => InputSourceDto)
  source: InputSourceDto;
  
  @ApiProperty({ description: '基础URL', required: false })
  @IsOptional()
  @IsUrl()
  baseUrl?: string;
  
  @ApiProperty({ description: '配置选项', required: false })
  @IsOptional()
  @IsObject()
  options?: ConfigurationOptions;
}

// 响应DTO
export class ConfigureResultDto {
  @ApiProperty({ description: 'API信息' })
  apiInfo: ApiInfo;
  
  @ApiProperty({ description: '端点列表' })
  endpoints: ApiEndpoint[];
  
  @ApiProperty({ description: '工具数量' })
  @IsNumber()
  toolsCount: number;
  
  @ApiProperty({ description: 'MCP服务器URL' })
  @IsUrl()
  mcpServerUrl: string;
  
  @ApiProperty({ description: '配置时间' })
  @IsDateString()
  configuredAt: string;
}
```

## 🔒 安全规范

### 认证与授权
```typescript
// JWT 认证策略（可选）
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }
  
  async validate(payload: any) {
    return { userId: payload.sub, username: payload.username };
  }
}

// API密钥验证（推荐）
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private configService: ConfigService) {}
  
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];
    const validApiKey = this.configService.get<string>('API_KEY');
    
    return !validApiKey || apiKey === validApiKey;
  }
}
```

### CORS 和安全中间件
```typescript
// main.ts 安全配置
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // CORS配置
  app.enableCors({
    origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:5173'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'mcp-session-id'],
  });
  
  // 安全中间件
  app.use(helmet());
  app.use(compression());
  
  // 全局前缀
  app.setGlobalPrefix('api');
  
  // 全局验证管道
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  );
  
  await app.listen(3001);
}
```

## 📊 监控与日志规范

### 结构化日志
```typescript
@Injectable()
export class LoggerService {
  private readonly logger = new Logger(LoggerService.name);
  
  logRequest(request: any, response: any, duration: number) {
    this.logger.log({
      type: 'request',
      method: request.method,
      url: request.url,
      statusCode: response.statusCode,
      duration,
      userAgent: request.headers['user-agent'],
      ip: request.ip,
    });
  }
  
  logError(error: any, context?: string) {
    this.logger.error({
      type: 'error',
      message: error.message,
      stack: error.stack,
      context,
    });
  }
}
```

### 健康检查
```typescript
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private http: HttpHealthIndicator,
    private memory: MemoryHealthIndicator,
  ) {}
  
  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.http.pingCheck('mcp-server', 'http://localhost:3322/health'),
      () => this.memory.checkHeap('memory_heap', 150 * 1024 * 1024),
      () => this.memory.checkRSS('memory_rss', 150 * 1024 * 1024),
    ]);
  }
}
```

### 性能监控
```typescript
@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const start = Date.now();
    const request = context.switchToHttp().getRequest();
    
    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - start;
        // 记录性能指标
        this.recordMetrics({
          endpoint: request.url,
          method: request.method,
          duration,
        });
      })
    );
  }
  
  private recordMetrics(metrics: any) {
    // 发送到监控系统 (Prometheus, DataDog, etc.)
  }
}
```

## 🧪 测试规范

### 单元测试
```typescript
describe('MCPService', () => {
  let service: MCPService;
  let mockDynamicServerService: jest.Mocked<DynamicServerService>;
  
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MCPService,
        {
          provide: DynamicServerService,
          useValue: {
            loadOpenAPISpec: jest.fn(),
            getCurrentTools: jest.fn(),
          },
        },
      ],
    }).compile();
    
    service = module.get<MCPService>(MCPService);
    mockDynamicServerService = module.get(DynamicServerService);
  });
  
  it('should handle MCP request correctly', async () => {
    const request: MCPRequest = {
      jsonrpc: '2.0',
      id: '1',
      method: 'tools/list',
    };
    
    mockDynamicServerService.getCurrentTools.mockResolvedValue([]);
    
    const result = await service.handleRequest(request);
    
    expect(result).toBeDefined();
    expect(mockDynamicServerService.getCurrentTools).toHaveBeenCalled();
  });
});
```

### 集成测试
```typescript
describe('AppController (e2e)', () => {
  let app: INestApplication;
  
  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    
    app = moduleFixture.createNestApplication();
    await app.init();
  });
  
  it('/api/openapi/configure (POST)', () => {
    return request(app.getHttpServer())
      .post('/api/openapi/configure')
      .send({
        source: {
          type: 'url',
          content: 'https://petstore.swagger.io/v2/swagger.json'
        }
      })
      .expect(200)
      .expect((res) => {
        expect(res.body.success).toBe(true);
        expect(res.body.data.toolsCount).toBeGreaterThan(0);
      });
  });
});
```

## 🚀 部署规范

### Docker配置
```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

# 复制依赖文件
COPY package*.json ./
COPY pnpm-lock.yaml ./

# 安装依赖
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile

# 复制源代码
COPY . .

# 构建应用
RUN pnpm run build

# 暴露端口
EXPOSE 3001

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/api/health || exit 1

# 启动应用
CMD ["node", "dist/main"]
```

### 环境变量配置
```bash
# .env.example
# 应用配置
NODE_ENV=development
PORT=3001
MCP_PORT=3322

# CORS配置
CORS_ORIGINS=http://localhost:5173,http://localhost:3000

# 安全配置
API_KEY=your-api-key-here
JWT_SECRET=your-jwt-secret-here

# 日志配置
LOG_LEVEL=info
LOG_FORMAT=json

# 性能配置
REQUEST_TIMEOUT=30000
CACHE_TTL=300

# 监控配置
METRICS_ENABLED=true
HEALTH_CHECK_INTERVAL=30000
```

### PM2配置
```json
{
  "apps": [{
    "name": "mcp-swagger-api",
    "script": "dist/main.js",
    "instances": "max",
    "exec_mode": "cluster",
    "env": {
      "NODE_ENV": "production",
      "PORT": 3001
    },
    "error_file": "logs/err.log",
    "out_file": "logs/out.log",
    "log_file": "logs/combined.log",
    "time": true,
    "max_memory_restart": "512M",
    "node_args": "--max-old-space-size=512"
  }]
}
```

## 📚 开发规范

### 代码风格
```json
// .eslintrc.js
module.exports = {
  extends: [
    '@nestjs',
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended'
  ],
  rules: {
    '@typescript-eslint/interface-name-prefix': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
  }
};
```

### Git工作流
```bash
# 分支命名规范
feature/add-mcp-protocol      # 新功能
bugfix/fix-session-handling  # Bug修复
hotfix/security-patch        # 紧急修复
refactor/improve-error-handling # 重构

# 提交信息规范
feat: add MCP protocol support
fix: resolve session timeout issue
docs: update API documentation
test: add unit tests for MCPService
refactor: improve error handling
```

### 版本发布
```json
// package.json scripts
{
  "scripts": {
    "build": "nest build",
    "start": "node dist/main",
    "start:dev": "nest start --watch",
    "start:debug": "nest start --debug --watch",
    "start:prod": "node dist/main",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:cov": "jest --coverage",
    "test:e2e": "jest --config ./test/jest-e2e.json",
    "lint": "eslint \"{src,apps,libs,test}/**/*.ts\" --fix",
    "format": "prettier --write \"src/**/*.ts\" \"test/**/*.ts\""
  }
}
```

这个技术规范为NestJS实施提供了完整的指导，涵盖了架构设计、安全规范、监控日志、测试部署等各个方面，确保项目能够按照最佳实践进行开发。
