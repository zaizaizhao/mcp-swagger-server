# MCP Swagger 完整部署指南

## 概述

本指南介绍如何在不同场景下部署和使用 mcp-swagger-api 和 mcp-swagger-server。

## 目录

1. [快速开始](#快速开始)
2. [mcp-swagger-api 部署](#mcp-swagger-api-部署)
3. [mcp-swagger-server 部署](#mcp-swagger-server-部署)
4. [集成使用](#集成使用)
5. [生产环境部署](#生产环境部署)
6. [监控和维护](#监控和维护)

## 快速开始

### 环境要求

- Node.js >= 18.0.0
- pnpm >= 8.0.0

### 安装依赖

```bash
# 根目录安装所有依赖
pnpm install

# 构建所有包
pnpm run build
```

## mcp-swagger-api 部署

### 本地开发

```bash
cd packages/mcp-swagger-api
pnpm run start:dev
```

服务将在 `http://localhost:3000` 启动，API文档可在 `http://localhost:3000/api` 查看。

### 环境配置

创建 `.env` 文件：

```env
# 服务配置
PORT=3000
NODE_ENV=development

# MCP 配置
MCP_DEFAULT_PORT=8765
MCP_API_KEY=your-secure-api-key

# 数据库配置（如果需要）
DATABASE_URL=postgresql://user:password@localhost:5432/mcp_swagger

# 日志配置
LOG_LEVEL=info
```

### Docker 部署

创建 `Dockerfile`：

```dockerfile
FROM node:18-alpine

WORKDIR /app

# 复制依赖文件
COPY package*.json ./
COPY pnpm-lock.yaml ./

# 安装 pnpm
RUN npm install -g pnpm

# 安装依赖
RUN pnpm install --frozen-lockfile

# 复制源代码
COPY . .

# 构建应用
RUN pnpm run build

# 暴露端口
EXPOSE 3000

# 启动应用
CMD ["pnpm", "run", "start:prod"]
```

```bash
# 构建镜像
docker build -t mcp-swagger-api .

# 运行容器
docker run -p 3000:3000 -e MCP_API_KEY=your-key mcp-swagger-api
```

### 使用示例

```bash
# 创建 MCP 服务器
curl -X POST http://localhost:3000/api/v1/mcp/create \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-key" \
  -d '{
    "openApiData": "https://petstore.swagger.io/v2/swagger.json",
    "config": {
      "name": "Petstore API",
      "port": 8765,
      "transport": "http"
    }
  }'

# 查看状态
curl http://localhost:3000/api/v1/mcp/status \
  -H "x-api-key: your-key"

# 获取监控指标
curl http://localhost:3000/api/v1/monitoring/metrics \
  -H "x-api-key: your-key"
```

## mcp-swagger-server 部署

### CLI 使用

```bash
cd packages/mcp-swagger-server

# 基本使用
pnpm run cli:help

# 使用远程 OpenAPI
pnpm run cli:github

# 使用本地文件并监听变化
pnpm run cli:enhanced -- -t sse -p 3322 -o ./openapi.json -w -v

# 使用配置文件
pnpm run cli:enhanced -- -c ./config.json
```

### 配置文件示例

创建 `mcp-config.json`：

```json
{
  "transport": "streamable",
  "port": 3322,
  "endpoint": "/mcp",
  "openapi": "https://api.github.com/openapi.json",
  "watch": false,
  "verbose": true
}
```

### Claude Desktop 集成

在 Claude Desktop 的配置文件中添加：

```json
{
  "mcpServers": {
    "mcp-swagger": {
      "command": "node",
      "args": ["/path/to/mcp-swagger-server/dist/cli-enhanced.js", 
               "-t", "stdio", 
               "-o", "https://api.github.com/openapi.json", 
               "-v"]
    }
  }
}
```

### 系统服务部署

创建 systemd 服务文件 `/etc/systemd/system/mcp-swagger.service`：

```ini
[Unit]
Description=MCP Swagger Server
After=network.target

[Service]
Type=simple
User=mcp
WorkingDirectory=/opt/mcp-swagger-server
ExecStart=/usr/bin/node dist/cli-enhanced.js -t streamable -p 3322 -o https://api.github.com/openapi.json -v
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

启动服务：

```bash
sudo systemctl enable mcp-swagger
sudo systemctl start mcp-swagger
sudo systemctl status mcp-swagger
```

## 集成使用

### 前端集成 (mcp-swagger-ui)

```typescript
// 在前端应用中集成
const createMCPServer = async (openApiUrl: string) => {
  const response = await fetch('/api/v1/mcp/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': 'your-api-key'
    },
    body: JSON.stringify({
      openApiData: openApiUrl,
      config: {
        name: 'Dynamic API',
        transport: 'websocket'
      }
    })
  });

  return response.json();
};

// 监控服务状态
const monitorStatus = async () => {
  const response = await fetch('/api/v1/mcp/status', {
    headers: { 'x-api-key': 'your-api-key' }
  });
  
  return response.json();
};
```

### API 网关集成

使用 Nginx 作为反向代理：

```nginx
upstream mcp_api {
    server localhost:3000;
}

upstream mcp_server {
    server localhost:3322;
}

server {
    listen 80;
    server_name api.yourdomain.com;

    # API 服务
    location /api/ {
        proxy_pass http://mcp_api;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # MCP 服务器
    location /mcp/ {
        proxy_pass http://mcp_server;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

## 生产环境部署

### 使用 Docker Compose

创建 `docker-compose.yml`：

```yaml
version: '3.8'

services:
  mcp-swagger-api:
    build: ./packages/mcp-swagger-api
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - MCP_API_KEY=${MCP_API_KEY}
      - DATABASE_URL=${DATABASE_URL}
    depends_on:
      - postgres
      - redis
    restart: always

  mcp-swagger-server:
    build: ./packages/mcp-swagger-server
    ports:
      - "3322:3322"
    environment:
      - NODE_ENV=production
    command: ["node", "dist/cli-enhanced.js", "-t", "streamable", "-p", "3322", "-o", "${OPENAPI_URL}", "-v"]
    restart: always

  postgres:
    image: postgres:15
    environment:
      - POSTGRES_DB=mcp_swagger
      - POSTGRES_USER=${DB_USER}
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/ssl/certs
    depends_on:
      - mcp-swagger-api
      - mcp-swagger-server

volumes:
  postgres_data:
  redis_data:
```

### Kubernetes 部署

创建 `k8s-deployment.yaml`：

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mcp-swagger-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: mcp-swagger-api
  template:
    metadata:
      labels:
        app: mcp-swagger-api
    spec:
      containers:
      - name: api
        image: mcp-swagger-api:latest
        ports:
        - containerPort: 3000
        env:
        - name: MCP_API_KEY
          valueFrom:
            secretKeyRef:
              name: mcp-secrets
              key: api-key
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"

---
apiVersion: v1
kind: Service
metadata:
  name: mcp-swagger-api-service
spec:
  selector:
    app: mcp-swagger-api
  ports:
  - port: 80
    targetPort: 3000
  type: LoadBalancer
```

## 监控和维护

### 健康检查

```bash
# API 服务健康检查
curl http://localhost:3000/api/v1/monitoring/health

# MCP 服务器健康检查
curl http://localhost:3322/health
```

### 日志管理

```bash
# 查看 API 服务日志
docker logs mcp-swagger-api

# 查看 MCP 服务器日志
sudo journalctl -u mcp-swagger -f

# 使用 ELK 栈收集日志
# Logstash 配置示例
input {
  file {
    path => "/var/log/mcp-swagger/*.log"
    type => "mcp-swagger"
  }
}

filter {
  if [type] == "mcp-swagger" {
    json {
      source => "message"
    }
  }
}

output {
  elasticsearch {
    hosts => ["localhost:9200"]
    index => "mcp-swagger-%{+YYYY.MM.dd}"
  }
}
```

### 性能监控

使用 Prometheus 和 Grafana：

```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'mcp-swagger-api'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/api/v1/monitoring/metrics'
    
  - job_name: 'mcp-swagger-server'
    static_configs:
      - targets: ['localhost:3322']
    metrics_path: '/metrics'
```

### 备份策略

```bash
#!/bin/bash
# backup.sh - 备份脚本

# 备份配置文件
cp /opt/mcp-swagger/config/*.json /backup/config/

# 备份数据库
pg_dump mcp_swagger | gzip > /backup/db/mcp_swagger_$(date +%Y%m%d).sql.gz

# 清理旧备份
find /backup -name "*.gz" -mtime +7 -delete
```

## 故障排除

### 常见问题

1. **端口冲突**
   ```bash
   # 检查端口占用
   lsof -i :3000
   lsof -i :3322
   
   # 更换端口
   export PORT=3001
   ```

2. **OpenAPI 加载失败**
   ```bash
   # 检查 URL 可访问性
   curl -I https://api.github.com/openapi.json
   
   # 检查本地文件权限
   ls -la ./openapi.json
   ```

3. **内存不足**
   ```bash
   # 检查内存使用
   free -h
   
   # 增加 Node.js 内存限制
   export NODE_OPTIONS="--max-old-space-size=4096"
   ```

### 性能优化

1. **API 服务优化**
   - 启用 Redis 缓存
   - 配置连接池
   - 启用 gzip 压缩

2. **MCP 服务器优化**
   - 减少轮询频率
   - 启用工具缓存
   - 优化 OpenAPI 解析

通过以上配置，你就可以在各种环境下成功部署和使用 MCP Swagger 系统了。
