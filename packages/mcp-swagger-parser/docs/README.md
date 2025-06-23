# MCP Swagger Parser 文档中心

欢迎来到 MCP Swagger Parser 的文档中心！这里包含了所有你需要了解这个 OpenAPI 解析器的信息。

## 📖 文档导航

### 🚀 快速开始
- **[README](../README.md)** - 项目概览和快速开始指南
- **[API 文档](./API_DOCUMENTATION.md)** - 详细的 API 使用说明和示例

### 🏗️ 架构与设计
- **[技术文档](./TECHNICAL_DOCUMENTATION.md)** - 深入的技术架构分析
- **[架构决策记录](./ARCHITECTURE_DECISIONS.md)** - 重要的架构决策和原因

### 📋 开发相关
- **[贡献指南](./CONTRIBUTING.md)** - 如何参与项目开发（待创建）
- **[更新日志](./CHANGELOG.md)** - 版本更新记录（待创建）

## 🎯 文档概览

### 对于使用者

如果你想**使用** MCP Swagger Parser：

1. 从 **[README](../README.md)** 开始，了解项目基本信息
2. 查看 **[API 文档](./API_DOCUMENTATION.md)** 学习具体用法
3. 参考其中的示例代码快速上手

### 对于开发者

如果你想**贡献代码**或**深入了解**项目：

1. 阅读 **[技术文档](./TECHNICAL_DOCUMENTATION.md)** 了解架构设计
2. 查看 **[架构决策记录](./ARCHITECTURE_DECISIONS.md)** 理解设计思路
3. 参考贡献指南了解开发流程

### 对于架构师

如果你想**评估技术方案**或**进行架构设计**：

1. **[技术文档](./TECHNICAL_DOCUMENTATION.md)** - 深入的技术分析和改进方向
2. **[架构决策记录](./ARCHITECTURE_DECISIONS.md)** - 关键技术决策的背景和考量

## 📚 文档详情

### [API 文档](./API_DOCUMENTATION.md)
- 完整的 API 参考
- 实际使用示例
- 配置选项说明
- 常见问题解答
- 性能优化建议

**适合**: 日常使用、集成开发、故障排除

### [技术文档](./TECHNICAL_DOCUMENTATION.md)
- 整体架构设计
- 核心模块详解
- 技术栈选择分析
- 性能优化策略
- 未来改进方向

**适合**: 深入理解、架构评估、技术选型

### [架构决策记录](./ARCHITECTURE_DECISIONS.md)
- 重要技术决策的背景
- 决策过程和考量因素
- 决策的影响和后果
- 未来的发展方向

**适合**: 架构设计、技术决策、项目规划

## 🔧 快速链接

### 常用代码示例

```typescript
// 基础使用
import { parseFromUrl, transformToMCPTools } from 'mcp-swagger-parser';

const result = await parseFromUrl('https://api.example.com/swagger.json');
const tools = transformToMCPTools(result.spec);
```

```typescript
// 高级配置
import { OpenAPIParser } from 'mcp-swagger-parser';

const parser = new OpenAPIParser({
  strictMode: false,
  validateSchema: true
});
```

### 核心概念

- **OpenAPISpec**: OpenAPI 规范的 TypeScript 类型
- **ParseResult**: 解析结果，包含规范、验证信息和元数据
- **MCPTool**: MCP 工具定义
- **ValidationResult**: 验证结果，包含错误和警告

### 主要特性

- ✅ **多输入源支持**: URL、文件、字符串
- ✅ **严格类型检查**: 完整的 TypeScript 支持
- ✅ **灵活验证**: 可配置的验证规则
- ✅ **高性能**: 优化的解析算法
- ✅ **可扩展**: 插件式架构设计

## 🆘 获取帮助

### 常见问题

1. **解析失败怎么办？**
   - 检查 OpenAPI 规范格式
   - 查看验证错误信息
   - 尝试非严格模式

2. **如何处理大文件？**
   - 使用缓存机制
   - 考虑分块处理
   - 监控内存使用

3. **如何自定义验证？**
   - 使用自定义验证规则
   - 实现 ValidationRule 接口
   - 添加到解析器配置

### 支持渠道

- **GitHub Issues**: 报告 Bug 和功能请求
- **文档**: 查阅完整的使用说明
- **示例代码**: 参考实际使用案例

## 📈 项目状态

- **当前版本**: 0.1.0
- **开发阶段**: Beta
- **测试覆盖率**: >90%
- **文档完整度**: 基础版本完成

## 🗺️ 发展路线图

### 短期目标 (1-2 个月)
- [ ] 完善单元测试
- [ ] 性能优化
- [ ] 错误处理增强

### 中期目标 (3-6 个月)
- [ ] 插件机制
- [ ] 多协议支持
- [ ] CLI 工具

### 长期目标 (6-12 个月)
- [ ] 可视化工具
- [ ] 生态系统建设
- [ ] 企业级特性

## 🤝 贡献

我们欢迎各种形式的贡献：

- 🐛 **Bug 报告**: 发现问题请提交 Issue
- 💡 **功能建议**: 有好想法请分享
- 📝 **文档改进**: 帮助完善文档
- 💻 **代码贡献**: 提交 Pull Request

详细的贡献指南请查看 [CONTRIBUTING.md](./CONTRIBUTING.md)（待创建）。

---

**最后更新**: 2025-06-20  
**版本**: 0.1.0  
**维护者**: MCP Swagger Team
