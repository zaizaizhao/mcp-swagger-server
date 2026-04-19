# MCP Swagger Server 文档索引

## 概览

当前仓库以终端和 CLI 工作流为主，核心能力集中在：

- `mcp-swagger-server`：交互式终端和命令行启动入口
- `mcp-swagger-parser`：OpenAPI / Swagger 解析与转换
- `mcp-swagger-api`：可选的 NestJS API 后端

此前单独的 `mcp-swagger-ui` 前端项目已移除，因此这里不再把 Web UI 文档作为当前能力入口。

## 快速开始

- [快速入门指南](./quick-start-guide.md)：本地安装、开发命令、常见排障
- [使用指南](./usage-guide.md)：命令行参数、典型用法、配置方式
- [Bearer Token 快速上手](./bearer-token-quickstart.md)：认证参数和常见配置

## 架构与实现

- [技术架构](./technical-architecture.md)：整体分层和主要模块
- [CLI 架构分析](./cli-architecture-analysis.md)：终端交互与命令入口
- [MCP 中心化架构设计](./mcp-centered-architecture-design.md)：协议和能力组织方式
- [部署指南](./deployment-guide.md)：运行、部署和环境准备

## 包级文档

- [mcp-swagger-server README](../packages/mcp-swagger-server/README.md)
- [mcp-swagger-parser README](../packages/mcp-swagger-parser/README.md)
- [mcp-swagger-api README](../packages/mcp-swagger-api/README.md)

## 说明

- `docs/` 目录下仍保留了一些历史方案、实验和迁移文档，便于回溯实现过程。
- 如果你只关心当前可运行能力，优先阅读上面的“快速开始”“架构与实现”和各包 README。
