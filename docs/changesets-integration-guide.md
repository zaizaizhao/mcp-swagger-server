# Changesets 集成指南

## 概述

Changesets 是一个用于管理 monorepo 版本控制和发布的工具，特别适合我们当前的 MCP Swagger 项目。它可以帮助我们：

- 自动化版本管理
- 生成 CHANGELOG
- 协调多包发布
- 简化发布流程

## 技术方案

### 1. 架构设计

```
mcp-swagger-server/
├── .changeset/
│   ├── config.json          # Changesets 配置
│   └── README.md           # 使用说明
├── packages/
│   ├── mcp-swagger-server/  # 主服务包
│   ├── mcp-swagger-parser/  # 解析器包
│   └── mcp-swagger-ui/      # UI包（可选）
└── package.json            # 根包配置
```

### 2. 工作流程

1. **开发阶段**：开发者完成功能后，运行 `changeset` 命令创建变更集
2. **PR 阶段**：变更集文件随 PR 一起提交
3. **发布阶段**：运行 `changeset version` 更新版本号，运行 `changeset publish` 发布包

## 配置方案

### 2.1 基础配置

```json
// .changeset/config.json
{
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "fixed": [],
  "linked": [],
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": ["@mcp-swagger/api"]
}
```

### 2.2 包配置说明

- **mcp-swagger-server**: 主包，独立版本管理
- **mcp-swagger-parser**: 解析器包，独立版本管理
- **@mcp-swagger/api**: 私有包，不发布（ignore）

### 2.3 版本策略

- **独立版本**：每个包维护自己的版本号
- **语义化版本**：遵循 semver 规范
- **自动更新依赖**：内部依赖自动更新为 patch 版本

## 实施计划

### 第一阶段：基础设置
1. 安装 Changesets 依赖
2. 初始化 Changesets 配置
3. 更新 package.json 脚本
4. 创建 GitHub Actions 工作流

### 第二阶段：集成测试
1. 创建测试变更集
2. 验证版本更新机制
3. 测试发布流程
4. 文档完善

### 第三阶段：生产部署
1. 正式启用 Changesets
2. 团队培训
3. 流程优化

## 脚本命令

### 2.1 开发命令
```bash
# 创建变更集
pnpm changeset

# 查看变更集状态
pnpm changeset status

# 更新版本号
pnpm changeset version

# 发布包
pnpm changeset publish
```

### 2.2 集成到 package.json
```json
{
  "scripts": {
    "changeset": "changeset",
    "changeset:version": "changeset version",
    "changeset:publish": "changeset publish",
    "changeset:status": "changeset status",
    "version-packages": "changeset version && pnpm install --lockfile-only",
    "release": "pnpm build && changeset publish"
  }
}
```

## GitHub Actions 集成

### 2.1 自动发布工作流
```yaml
name: Release
on:
  push:
    branches:
      - main

jobs:
  release:
    name: Release
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Repo
        uses: actions/checkout@v3
        with:
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Install Dependencies
        run: pnpm install --frozen-lockfile

      - name: Build packages
        run: pnpm build

      - name: Create Release Pull Request or Publish
        id: changesets
        uses: changesets/action@v1
        with:
          publish: pnpm release
          commit: "chore: release packages"
          title: "chore: release packages"
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### 2.2 变更集验证工作流
```yaml
name: Changeset Check
on:
  pull_request:
    branches:
      - main

jobs:
  changeset:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Repo
        uses: actions/checkout@v3
        with:
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Install Dependencies
        run: pnpm install --frozen-lockfile

      - name: Check for changeset
        run: pnpm changeset status --since=origin/main
```

## 使用流程

### 2.1 开发者工作流

1. **开发功能**
   ```bash
   # 开发你的功能
   git checkout -b feature/new-feature
   # ... 编写代码
   ```

2. **创建变更集**
   ```bash
   pnpm changeset
   ```
   
   系统会提示：
   - 选择要更新的包
   - 选择版本类型（major/minor/patch）
   - 输入变更描述

3. **提交变更**
   ```bash
   git add .
   git commit -m "feat: add new feature"
   git push origin feature/new-feature
   ```

### 2.2 维护者工作流

1. **合并 PR 后发布**
   ```bash
   # 更新版本号
   pnpm changeset version
   
   # 安装依赖（更新 lockfile）
   pnpm install
   
   # 提交版本更新
   git add .
   git commit -m "chore: bump versions"
   git push
   
   # 发布包
   pnpm changeset publish
   ```

## 最佳实践

### 2.1 变更集编写规范
- **简洁明了**：描述要简洁但足够详细
- **用户视角**：从用户角度描述变更
- **分类标识**：使用 feat/fix/breaking 等标识

### 2.2 版本选择指南
- **patch**: 修复 bug，向后兼容
- **minor**: 新功能，向后兼容
- **major**: 破坏性变更，不向后兼容

### 2.3 发布策略
- **定期发布**：建议每周或每两周发布一次
- **紧急修复**：重要 bug 修复可以立即发布
- **预发布**：重大更新可以先发布 alpha/beta 版本

## 迁移计划

### 2.1 当前状态分析
- 当前版本：mcp-swagger-server@1.0.9, mcp-swagger-parser@1.0.5
- 发布方式：手动 `pnpm pack` 命令
- 版本管理：手动更新

### 2.2 迁移步骤
1. **安装和配置 Changesets**
2. **为现有包创建初始变更集**
3. **更新构建和发布脚本**
4. **配置 CI/CD 流程**
5. **团队培训和文档更新**

## 风险评估

### 2.1 技术风险
- **学习成本**：团队需要学习 Changesets 工作流
- **配置复杂性**：初始配置需要仔细调试
- **自动化风险**：自动发布可能导致意外发布

### 2.2 缓解措施
- **渐进式迁移**：先在开发环境测试
- **双重检查**：保留手动发布选项
- **回滚机制**：准备回滚到原有流程的方案

## 结论

Changesets 的集成将显著提升我们的版本管理和发布效率，特别是在 monorepo 环境中。通过自动化的版本管理和发布流程，可以减少人为错误，提高发布质量。

建议采用渐进式迁移策略，先在开发环境充分测试，确认无误后再正式启用。

## 参考资料

- [Changesets 官方文档](https://github.com/changesets/changesets)
- [pnpm Changesets 集成指南](https://pnpm.io/using-changesets)
- [语义化版本规范](https://semver.org/)
