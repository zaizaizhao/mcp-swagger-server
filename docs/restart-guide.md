# MCP Server 重启管理指南

本指南介绍如何设置和使用具有自动重启功能的 MCP Server。

## 🎯 概述

MCP Server Manager 提供了以下重启能力：
- **自动重启**：进程崩溃或退出时自动重启
- **健康检查**：定期监控服务器状态
- **内存管理**：内存使用超限时自动重启
- **错误恢复**：可配置的重试策略和退避算法
- **会话管理**：多用户并发会话支持
- **日志记录**：详细的操作日志和统计信息

## 🚀 快速开始

### 1. 基本用法

```bash
# 启动带自动重启的服务器
npm run start:managed

# 或者直接使用参数
node dist/index.js --managed --auto-restart
```

### 2. 使用专用管理工具

```bash
# 启动服务器
npm run manager:start

# 停止服务器
npm run manager:stop

# 重启服务器
npm run manager:restart

# 查看状态
npm run manager:status

# 查看日志
npm run manager:logs
```

### 3. Windows PowerShell

```powershell
# 启动服务器
.\mcp-manager.ps1 start

# 后台运行
.\mcp-manager.ps1 start -Daemon

# 自定义配置
.\mcp-manager.ps1 start -Transport streamable -Port 8080 -MemoryLimit 1024
```

## ⚙️ 配置选项

### 命令行参数

| 参数 | 描述 | 默认值 |
|------|------|--------|
| `--managed` | 启用管理模式 | false |
| `--auto-restart` | 启用自动重启 | false |
| `--max-retries` | 最大重试次数 | 5 |
| `--transport` | 传输协议 | stdio |
| `--port` | 服务器端口 | 3322 |
| `--endpoint` | 端点路径 | /sse |

### 配置文件 (mcp-config.json)

```json
{
  "maxRetries": 10,
  "retryDelay": 1000,
  "backoffMultiplier": 1.5,
  "maxRetryDelay": 30000,
  "healthCheckInterval": 30000,
  "healthCheckTimeout": 5000,
  "autoRestart": true,
  "restartOnError": true,
  "restartOnExit": true,
  "restartOnMemoryLimit": 512,
  "logLevel": "info",
  "logToFile": true,
  "logFilePath": "mcp-server.log"
}
```

## 📊 重启策略

### 1. 退避算法

重启延迟计算公式：
```
delay = min(retryDelay * (backoffMultiplier ^ restartCount), maxRetryDelay)
```

示例：
- 第1次重启：1000ms
- 第2次重启：1500ms
- 第3次重启：2250ms
- 第4次重启：3375ms
- 第5次重启：5062ms
- ...最大30000ms

### 2. 重启触发条件

- **进程退出**：服务器进程意外退出
- **运行时错误**：捕获到未处理的异常
- **健康检查失败**：进程无响应或检查失败
- **内存超限**：内存使用超过设定阈值
- **手动重启**：通过管理工具主动重启

### 3. 重试限制

达到最大重试次数后：
- 停止自动重启
- 记录错误日志
- 发送告警事件
- 保持PID文件以供调试

## 🔍 监控与诊断

### 1. 实时状态监控

```bash
# 查看详细状态
npm run manager:status
```

输出示例：
```
📊 MCP 服务器状态:
状态: 🟢 运行中
PID: 12345
启动时间: 2025-06-14 10:30:00
重启次数: 3
最后重启: 2025-06-14 12:15:30
重启原因: 内存使用超限: 600.5MB
内存使用: 245.2 MB
```

### 2. 日志分析

```bash
# 查看最新日志
npm run manager:logs

# 或直接查看日志文件
tail -f mcp-server.log
```

### 3. 统计信息

服务器会自动生成 `mcp-server-stats.json` 文件：
```json
{
  "startTime": "2025-06-14T10:30:00.000Z",
  "restartCount": 3,
  "lastRestartTime": "2025-06-14T12:15:30.000Z",
  "lastRestartReason": "内存使用超限: 600.5MB",
  "isRunning": true,
  "processId": 12345,
  "memoryUsage": {
    "rss": 257036288,
    "heapTotal": 28311552,
    "heapUsed": 16258144,
    "external": 1089024
  }
}
```

## 🛠️ 高级配置

### 1. 自定义健康检查

可以在代码中扩展健康检查逻辑：

```typescript
// 在 MCPServerManager 中添加自定义检查
manager.on('healthCheck', ({ memoryMB, isHealthy }) => {
  // 自定义健康检查逻辑
  if (memoryMB > 800) {
    console.warn('内存使用过高，建议重启');
  }
});
```

### 2. 集成外部监控

```typescript
// 集成监控系统
manager.on('restarted', ({ reason, restartCount }) => {
  // 发送到监控系统
  monitoringSystem.send({
    event: 'mcp_server_restarted',
    reason,
    restartCount,
    timestamp: new Date()
  });
});
```

### 3. 多实例管理

```bash
# 启动多个实例
node dist/index.js --managed --port 3322 --transport sse &
node dist/index.js --managed --port 3323 --transport streamable &
```

## 🚨 故障排除

### 1. 常见问题

**问题**：服务器无法启动
- 检查端口是否被占用
- 验证配置文件格式
- 查看错误日志

**问题**：频繁重启
- 检查内存限制设置
- 分析重启原因
- 调整重试策略

**问题**：健康检查失败
- 验证进程是否响应
- 检查系统资源
- 调整检查间隔

### 2. 调试模式

```bash
# 启用详细日志
node dist/index.js --managed --auto-restart 2>&1 | tee debug.log

# 使用调试级别
node dist/index.js --managed --log-level debug
```

### 3. 手动恢复

```bash
# 强制停止所有进程
pkill -f "mcp-swagger-server"

# 清理状态文件
rm -f mcp-server.pid mcp-server-stats.json

# 重新启动
npm run manager:start
```

## 📝 最佳实践

### 1. 生产环境配置

```json
{
  "maxRetries": 3,
  "retryDelay": 5000,
  "healthCheckInterval": 60000,
  "restartOnMemoryLimit": 1024,
  "logLevel": "warn",
  "autoRestart": true
}
```

### 2. 开发环境配置

```json
{
  "maxRetries": 10,
  "retryDelay": 1000,
  "healthCheckInterval": 10000,
  "restartOnMemoryLimit": 256,
  "logLevel": "debug",
  "autoRestart": true
}
```

### 3. 部署建议

- 使用进程管理器（如 PM2、systemd）作为额外保障
- 配置日志轮转避免日志文件过大
- 设置监控告警通知运维团队
- 定期备份配置和统计文件
- 建立重启频率阈值告警

### 4. 安全考虑

- 限制日志文件权限
- 定期清理过期的统计文件
- 监控异常重启模式
- 设置资源使用上限

## 🔗 集成示例

### 与 PM2 集成

```json
{
  "name": "mcp-server",
  "script": "dist/index.js",
  "args": ["--managed", "--auto-restart"],
  "instances": 1,
  "exec_mode": "fork",
  "watch": false,
  "max_memory_restart": "512M",
  "env": {
    "NODE_ENV": "production"
  }
}
```

### 与 systemd 集成

```ini
[Unit]
Description=MCP Swagger Server
After=network.target

[Service]
Type=simple
User=mcpuser
WorkingDirectory=/opt/mcp-server
ExecStart=/usr/bin/node dist/index.js --managed --auto-restart
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

这个重启管理系统为你的 MCP Server 提供了企业级的可靠性和可维护性。
