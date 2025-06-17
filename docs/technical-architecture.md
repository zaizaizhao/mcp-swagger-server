# MCP Swagger Server 技术架构设计

## 🏗️ 系统架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                        前端界面层                            │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │  输入组件   │ │  预览组件   │ │  配置组件   │           │
│  │ URL/文件/文本│ │ API信息展示 │ │ 转换参数设置│           │
│  └─────────────┘ └─────────────┘ └─────────────┘           │
│         │               │               │                 │
│         └───────────────┼───────────────┘                 │
│                         │                                 │
└─────────────────────────┼─────────────────────────────────┘
                          │ HTTP API 调用
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                        API 网关层                           │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │   路由管理  │ │   认证鉴权  │ │   CORS处理  │           │
│  │ /api/convert│ │   API Key   │ │  跨域请求   │           │
│  │ /api/validate│ │   Rate Limit│ │   安全头    │           │
│  └─────────────┘ └─────────────┘ └─────────────┘           │
└─────────────────────────┼─────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                        业务逻辑层                            │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │ OpenAPI解析 │ │  MCP转换器  │ │  配置生成器 │           │
│  │  格式验证   │ │  工具生成   │ │ JSON输出格式│           │
│  │  结构分析   │ │  参数映射   │ │  YAML输出   │           │
│  └─────────────┘ └─────────────┘ └─────────────┘           │
└─────────────────────────┼─────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                        数据处理层                            │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │ 文件系统IO  │ │  HTTP客户端 │ │  缓存管理   │           │
│  │  本地文件   │ │  远程URL    │ │  结果缓存   │           │
│  │  临时存储   │ │  认证处理   │ │  配置缓存   │           │
│  └─────────────┘ └─────────────┘ └─────────────┘           │
└─────────────────────────────────────────────────────────────┘
```

## 🔧 技术栈详细设计

### 前端技术栈
```
┌─────────────────────────────────────────┐
│              React.js 18+               │
│  ┌─────────────┐ ┌─────────────┐       │
│  │   状态管理  │ │   UI组件库  │       │
│  │   Zustand   │ │ Ant Design  │       │
│  │   Context   │ │   Tailwind  │       │
│  └─────────────┘ └─────────────┘       │
│  ┌─────────────┐ ┌─────────────┐       │
│  │   HTTP客户端│ │   开发工具  │       │
│  │    Axios    │ │    Vite     │       │
│  │   SWR/RQ    │ │  TypeScript │       │
│  └─────────────┘ └─────────────┘       │
└─────────────────────────────────────────┘
```

### 后端技术栈  
```
┌─────────────────────────────────────────┐
│               Node.js                   │
│  ┌─────────────┐ ┌─────────────┐       │
│  │  Web框架    │ │   数据验证  │       │
│  │   Express   │ │     Zod     │       │
│  │    CORS     │ │   Joi/Yup   │       │
│  └─────────────┘ └─────────────┘       │
│  ┌─────────────┐ ┌─────────────┐       │
│  │   文件处理  │ │   类型系统  │       │
│  │   Multer    │ │ TypeScript  │       │
│  │  fs-extra   │ │    ESLint   │       │
│  └─────────────┘ └─────────────┘       │
└─────────────────────────────────────────┘
```

## 📡 API 接口设计

### 核心 API 端点

#### 1. 转换 API
```http
POST /api/v1/convert
Content-Type: application/json

{
  "source": {
    "type": "url|file|text",
    "content": "https://api.example.com/swagger.json",
    "auth": {
      "type": "bearer|apikey|basic",
      "token": "your-token"
    }
  },
  "config": {
    "filters": {
      "methods": ["GET", "POST"],
      "tags": ["pet", "store"],
      "includeDeprecated": false
    },
    "transport": "stdio|sse|streamable",
    "optimization": {
      "generateValidation": true,
      "includeExamples": false,
      "optimizeNames": true
    }
  }
}
```

响应格式：
```json
{
  "success": true,
  "data": {
    "mcpConfig": {
      "mcpServers": { /* MCP配置 */ },
      "tools": [ /* 工具列表 */ ]
    },
    "metadata": {
      "apiInfo": {
        "title": "Pet Store API",
        "version": "1.0.0",
        "serverUrl": "https://petstore.swagger.io/v2"
      },
      "stats": {
        "totalEndpoints": 20,
        "convertedTools": 15,
        "skippedEndpoints": 5
      }
    }
  },
  "processingTime": 1234
}
```

#### 2. 验证 API
```http
POST /api/v1/validate
Content-Type: application/json

{
  "source": {
    "type": "url|file|text",
    "content": "OpenAPI规范内容"
  }
}
```

#### 3. 预览 API
```http
POST /api/v1/preview
Content-Type: application/json

{
  "source": { /* 同上 */ }
}
```

#### 4. 健康检查 API
```http
GET /api/v1/health
```

## 🔐 安全设计

### 输入验证
```typescript
// Zod 验证模式
const ConvertRequestSchema = z.object({
  source: z.object({
    type: z.enum(['url', 'file', 'text']),
    content: z.string().min(1).max(1024 * 1024), // 1MB限制
    auth: z.object({
      type: z.enum(['bearer', 'apikey', 'basic']).optional(),
      token: z.string().optional()
    }).optional()
  }),
  config: z.object({
    filters: z.object({
      methods: z.array(z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH'])).optional(),
      tags: z.array(z.string()).optional(),
      includeDeprecated: z.boolean().default(false)
    }).optional(),
    transport: z.enum(['stdio', 'sse', 'streamable']).default('stdio'),
    optimization: z.object({
      generateValidation: z.boolean().default(true),
      includeExamples: z.boolean().default(false),
      optimizeNames: z.boolean().default(true)
    }).optional()
  }).optional()
});
```

### 安全措施
- **输入大小限制**: 文件上传限制 5MB
- **URL 白名单**: 可配置的允许访问的域名列表
- **速率限制**: 每IP每分钟最多10个请求
- **CORS 配置**: 正确配置跨域访问策略
- **内容类型验证**: 严格验证上传文件类型

## 📊 性能优化

### 缓存策略
```typescript
interface CacheStrategy {
  // Redis 缓存配置
  redis: {
    host: string;
    port: number;
    ttl: number; // 24小时
  };
  
  // 内存缓存
  memory: {
    maxSize: number; // 100MB
    ttl: number; // 1小时
  };
  
  // 缓存键策略
  keyGeneration: {
    source: (content: string) => string; // SHA256
    config: (config: object) => string;
  };
}
```

### 异步处理
```typescript
// 大文件异步处理
class AsyncProcessor {
  async processLargeSpec(spec: OpenAPISpec): Promise<string> {
    const jobId = generateJobId();
    
    // 加入队列
    await jobQueue.add('convert', {
      jobId,
      spec,
      timestamp: Date.now()
    });
    
    return jobId;
  }
  
  async getJobStatus(jobId: string): Promise<JobStatus> {
    return await jobQueue.getJob(jobId);
  }
}
```

## 🔍 监控与日志

### 日志系统
```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: 'logs/combined.log' 
    })
  ]
});
```

### 性能监控
```typescript
// 请求耗时追踪
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('Request processed', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      userAgent: req.get('User-Agent')
    });
  });
  
  next();
});
```

## 🚀 部署架构

### Docker 容器化
```dockerfile
# 多阶段构建
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:18-alpine AS runtime
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

### Kubernetes 部署
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mcp-swagger-server
spec:
  replicas: 3
  selector:
    matchLabels:
      app: mcp-swagger-server
  template:
    metadata:
      labels:
        app: mcp-swagger-server
    spec:
      containers:
      - name: server
        image: mcp-swagger-server:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
```

## 📈 扩展性设计

### 插件系统
```typescript
interface ConverterPlugin {
  name: string;
  version: string;
  
  // 支持的OpenAPI版本
  supportedVersions: string[];
  
  // 转换逻辑
  convert(spec: OpenAPISpec, config: ConvertConfig): Promise<MCPTools>;
  
  // 验证逻辑
  validate(spec: OpenAPISpec): Promise<ValidationResult>;
}

class PluginManager {
  private plugins: Map<string, ConverterPlugin> = new Map();
  
  register(plugin: ConverterPlugin): void {
    this.plugins.set(plugin.name, plugin);
  }
  
  async convert(pluginName: string, spec: OpenAPISpec, config: ConvertConfig): Promise<MCPTools> {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
      throw new Error(`Plugin ${pluginName} not found`);
    }
    
    return await plugin.convert(spec, config);
  }
}
```

### 微服务架构
```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   前端服务  │    │   API网关   │    │  转换服务   │
│   Nginx     │◄──►│   Express   │◄──►│   Worker    │
│   静态资源  │    │   路由/认证 │    │   队列处理  │
└─────────────┘    └─────────────┘    └─────────────┘
                            │
                            ▼
                   ┌─────────────┐
                   │   缓存服务  │
                   │    Redis    │
                   │   结果缓存  │
                   └─────────────┘
```

这个技术架构设计提供了完整的前后端交互方案，确保系统的可扩展性、安全性和性能。
