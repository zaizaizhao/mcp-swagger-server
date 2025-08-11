# WebSocket连接问题诊断指南 (已更新)

## 问题描述
UI项目在建立WebSocket连接后立即断开，无法维持稳定的连接来获取子进程状态和日志信息。

## 最新修复内容

### 1. 后端增强
- ✅ 更详细的CORS配置
- ✅ 增强的连接日志记录  
- ✅ 断开前事件监听 (disconnecting)
- ✅ 错误和ping/pong事件监听
- ✅ 房间自动重新加入机制
- ✅ 心跳ping处理器

### 2. 前端增强  
- ✅ 心跳保活机制 (每30秒)
- ✅ 连接状态监控 (每10秒)
- ✅ 订阅确认机制
- ✅ 订阅重试逻辑
- ✅ 增强的断开重连逻辑

## 排查步骤

### 1. 检查服务状态
```bash
# 检查API服务是否正常运行
curl -I http://localhost:3001/api/health

# 检查WebSocket端点是否可访问
curl -I http://localhost:3001/monitoring/socket.io/
```

### 2. 前端调试工具

在浏览器控制台中使用新的调试工具：

```javascript
// 基本调试
wsDebug.logs()        // 查看连接日志
wsDebug.report()      // 生成详细报告
wsDebug.analyze()     // 分析连接模式

// 新增测试工具
wsTest.test()         // 运行完整连接测试
wsTest.monitor()      // 开始连接监控
wsTest.status()       // 查看当前状态
wsTest.subscribe('server-id')  // 测试订阅
```

### 3. 后端日志关键指标

查看以下关键日志：
- `🔄 Client X is disconnecting with reason: Y` - 断开原因
- `🔍 Room verification after 1s` - 房间验证结果
- `🏓 Ping/Pong` - 心跳状态
- `❌ Client X disappeared from room` - 房间消失检测

### 4. 新增的自动修复机制

#### A. 自动房间重新加入
如果检测到客户端意外离开房间，系统会：
1. 记录详细的断开信息
2. 尝试重新将客户端加入房间
3. 验证重新加入是否成功

#### B. 心跳保活
- 前端每30秒发送心跳ping
- 后端响应pong并更新活动时间
- 连接异常时自动重连

#### C. 订阅确认机制
- 订阅后等待服务器确认
- 3秒内未确认则重试
- 防止订阅丢失

## 实时监控命令

```javascript
// 启动实时监控
const stopMonitor = wsTest.monitor();

// 查看实时连接状态
wsTest.status();

// 停止监控
stopMonitor();
```

## 问题仍然存在？

如果上述修复仍无法解决问题，请尝试：

### 1. 强制轮询模式
```typescript
// 在websocket.ts中临时修改
transports: ["polling"]  // 只使用轮询
```

### 2. 降级到原生WebSocket
```javascript
// 作为最后手段，使用原生WebSocket
const ws = new WebSocket('ws://localhost:3001/monitoring');
ws.onopen = () => console.log('原生WebSocket连接成功');
ws.onclose = (e) => console.log('原生WebSocket断开:', e.reason);
```

### 3. 检查网络代理
- 禁用浏览器代理
- 检查防火墙设置
- 尝试使用不同的端口

## 成功指标

连接稳定的标志：
- ✅ `wsTest.test()` 返回 true
- ✅ 房间验证始终显示 size > 0
- ✅ 心跳ping/pong正常响应
- ✅ 订阅确认成功接收
- ✅ 进程指标数据正常接收

## 获取支持

如果问题仍未解决，请提供：
1. `wsDebug.report()` 的完整输出
2. 后端日志中的断开原因
3. `wsTest.test()` 的测试结果
4. 网络环境信息 (代理、防火墙等)
