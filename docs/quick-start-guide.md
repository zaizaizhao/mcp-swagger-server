# MCP Swagger Server - 快速入门指南

## 项目概述

本项目是一个基于 monorepo 架构的 OpenAPI/Swagger 到 MCP (Model Context Protocol) 转换工具集，包含解析器、服务器和前端界面三个主要组件。

## 项目结构

```
mcp-swagger-server/
├── packages/
│   ├── mcp-swagger-parser/    # 核心解析器包
│   ├── mcp-swagger-server/    # MCP 服务器
│   └── mcp-swagger-ui/        # Vue.js 前端界面
├── scripts/
│   ├── build.js              # 统一构建脚本
│   ├── dev.js                # 开发环境脚本
│   ├── clean.js              # 清理脚本
│   └── diagnostic.js         # 诊断脚本
├── docs/                     # 技术文档
└── README.md
```

## 环境要求

- **Node.js**: >=18.0.0
- **pnpm**: 最新版本（推荐使用 pnpm 作为包管理器）
- **操作系统**: macOS, Linux, Windows

## 安装指南

### 1. 安装 pnpm

选择以下任一方式安装 pnpm：

**方式一：使用 Homebrew（macOS 推荐）**
```bash
brew install pnpm
```

**方式二：使用 npm**
```bash
# 配置 npm 全局目录（避免权限问题）
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.zshrc
source ~/.zshrc

# 安装 pnpm
npm install -g pnpm
```

**方式三：使用 Corepack（Node.js 16.10+）**
```bash
corepack enable
corepack prepare pnpm@latest --activate
```

### 2. 克隆并安装项目

```bash
# 克隆项目
git clone <repository-url>
cd mcp-swagger-server

# 安装依赖（会自动构建依赖包）
pnpm install
```

## 开发指南

### 快速启动开发环境

```bash
# 启动完整开发环境
pnpm run dev
```

这个命令会：
1. 构建所有依赖包
2. 启动依赖包的 watch 模式
3. 启动前端开发服务器

### 仅启动前端开发

```bash
# 仅启动 UI 开发服务器
pnpm run dev:ui
```

### 构建项目

```bash
# 构建所有包
pnpm run build

# 仅构建依赖包（不包括前端）
pnpm run build:packages
```

### 清理项目

```bash
# 清理所有构建产物和 node_modules
pnpm run clean

# 仅清理构建产物
pnpm run clean:build
```

### 项目诊断

```bash
# 运行项目健康检查
pnpm run diagnostic
```

## 包管理说明

### 依赖关系图

```
mcp-swagger-ui
    ↓ depends on
mcp-swagger-parser
    ↓ depends on
External packages (axios, swagger-parser, etc.)
```

### 为什么需要预先构建

1. **TypeScript 编译链**: 源码在 `src/`，但包入口指向编译后的 `dist/`
2. **模块解析机制**: Vite 等构建工具需要找到实际的入口文件
3. **类型检查**: TypeScript 需要 `.d.ts` 类型定义文件

### 自动化构建的优势

- **依赖拓扑排序**: 自动按正确顺序构建包
- **并行优化**: 无依赖关系的包可并行构建
- **增量构建**: 只构建变更的包及其依赖者
- **错误处理**: 构建失败时提供详细诊断信息

## 开发最佳实践

### 1. 开发新功能

```bash
# 1. 确保环境干净
pnpm run clean:build

# 2. 安装最新依赖
pnpm install

# 3. 启动开发环境
pnpm run dev
```

### 2. 添加新包

1. 在 `packages/` 目录下创建新包
2. 添加 `package.json` 文件
3. 如果有构建需求，确保包含 `build` 脚本
4. 运行 `pnpm run diagnostic` 验证配置

### 3. 处理依赖问题

```bash
# 1. 运行诊断
pnpm run diagnostic

# 2. 检查特定包的构建状态
cd packages/mcp-swagger-parser
pnpm run build

# 3. 清理并重新构建
pnpm run clean
pnpm install
```

### 4. 性能优化

- 使用 `pnpm run build:packages` 跳过前端构建
- 利用 watch 模式进行增量编译
- 定期清理构建缓存

## 故障排除

### 常见问题

#### 1. 权限错误
```
Error: EACCES: permission denied
```
**解决方案**: 使用 Homebrew 安装 pnpm 或配置 npm 全局目录

#### 2. 依赖解析失败
```
Failed to resolve entry for package "mcp-swagger-parser"
```
**解决方案**: 
```bash
pnpm run build:packages
```

#### 3. 类型检查错误
```
Cannot find module 'mcp-swagger-parser'
```
**解决方案**: 确保包已构建并生成类型定义文件

#### 4. 开发服务器启动失败
**解决方案**: 
```bash
# 重置环境
pnpm run clean
pnpm install
pnpm run dev
```

### 调试技巧

1. **使用诊断脚本**:
   ```bash
   pnpm run diagnostic
   ```

2. **检查构建日志**:
   ```bash
   pnpm run build --verbose
   ```

3. **逐包调试**:
   ```bash
   cd packages/specific-package
   pnpm run build
   ```

## 部署指南

### 生产构建

```bash
# 清理环境
pnpm run clean

# 安装生产依赖
pnpm install --frozen-lockfile

# 构建所有包
pnpm run build
```

### Docker 部署

```dockerfile
FROM node:18-alpine

# 安装 pnpm
RUN npm install -g pnpm

WORKDIR /app

# 复制依赖文件
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/*/package.json ./packages/*/

# 安装依赖
RUN pnpm install --frozen-lockfile

# 复制源码
COPY . .

# 构建项目
RUN pnpm run build

EXPOSE 3000

CMD ["pnpm", "start"]
```

## 脚本说明

### build.js
- 智能包发现和依赖分析
- 拓扑排序确保正确构建顺序
- 支持选择性构建（`--non-ui`）

### dev.js
- 自动构建依赖包
- 启动 watch 模式
- 启动开发服务器

### clean.js
- 清理构建产物
- 支持选择性清理（`--build-only`）

### diagnostic.js
- 项目结构检查
- 依赖完整性验证
- 构建产物验证
- 脚本可用性检查

## 贡献指南

1. Fork 项目
2. 创建功能分支: `git checkout -b feature/amazing-feature`
3. 提交更改: `git commit -m 'Add amazing feature'`
4. 推送分支: `git push origin feature/amazing-feature`
5. 创建 Pull Request

## 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

---

*本指南持续更新，如有问题请提交 Issue。*
