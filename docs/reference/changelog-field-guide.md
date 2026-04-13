# Changesets Changelog 字段详解和实际效果

## 1. 基本概念

`changelog` 字段控制 Changesets 如何生成每个包的 CHANGELOG.md 文件。不同的配置会产生不同格式的 changelog。

## 2. 本项目的配置分析

### 当前配置
```json
{
  "changelog": ["@changesets/changelog-github", {
    "repo": "user/repo-name"  // 需要替换为实际的 GitHub 仓库
  }]
}
```

### 配置说明
- `@changesets/changelog-github`: 使用 GitHub 风格的 changelog 生成器
- `repo`: 指定 GitHub 仓库，用于生成链接

## 3. 不同配置的效果对比

### 3.1 默认配置 (简单格式)
```json
{
  "changelog": "@changesets/cli/changelog"
}
```

**生成的 CHANGELOG.md 示例：**
```markdown
# mcp-swagger-server

## 1.0.10
### Minor Changes
- Added new authentication feature

### Patch Changes
- Fixed bug in parser
- Updated dependencies
```

### 3.2 GitHub 配置 (带链接格式)
```json
{
  "changelog": ["@changesets/changelog-github", {
    "repo": "yourname/mcp-swagger-server"
  }]
}
```

**生成的 CHANGELOG.md 示例：**
```markdown
# mcp-swagger-server

## 1.0.10

### Minor Changes

- [#123](https://github.com/yourname/mcp-swagger-server/pull/123) [`a1b2c3d`](https://github.com/yourname/mcp-swagger-server/commit/a1b2c3d) Thanks [@contributor](https://github.com/contributor)! - Added new authentication feature

### Patch Changes

- [#124](https://github.com/yourname/mcp-swagger-server/pull/124) [`e4f5g6h`](https://github.com/yourname/mcp-swagger-server/commit/e4f5g6h) Thanks [@maintainer](https://github.com/maintainer)! - Fixed bug in parser

- Updated dependencies
  - mcp-swagger-parser@1.0.6
```

### 3.3 禁用 changelog
```json
{
  "changelog": false
}
```

**效果：** 不生成 CHANGELOG.md 文件

## 4. 实际工作流程示例

### 4.1 开发者添加 changeset
```bash
pnpm changeset
```

**交互式选择：**
```
? Which packages would you like to include? 
✓ mcp-swagger-server
✓ mcp-swagger-parser

? Which packages should have a major bump? 
  (none selected)

? Which packages should have a minor bump? 
✓ mcp-swagger-server

? Which packages should have a patch bump? 
✓ mcp-swagger-parser

? Please enter a summary for this change:
Added Bearer token authentication support and fixed parser edge cases
```

**生成的 .changeset 文件：**
```markdown
---
"mcp-swagger-server": minor
"mcp-swagger-parser": patch
---

Added Bearer token authentication support and fixed parser edge cases
```

### 4.2 发布时的 changelog 生成

运行 `pnpm changeset version` 后：

**mcp-swagger-server/CHANGELOG.md:**
```markdown
# mcp-swagger-server

## 1.1.0

### Minor Changes

- [#45](https://github.com/yourname/mcp-swagger-server/pull/45) [`abc123`](https://github.com/yourname/mcp-swagger-server/commit/abc123) Thanks [@developer](https://github.com/developer)! - Added Bearer token authentication support and fixed parser edge cases

### Patch Changes

- Updated dependencies
  - mcp-swagger-parser@1.0.6
```

**mcp-swagger-parser/CHANGELOG.md:**
```markdown
# mcp-swagger-parser

## 1.0.6

### Patch Changes

- [#45](https://github.com/yourname/mcp-swagger-server/pull/45) [`abc123`](https://github.com/yourname/mcp-swagger-server/commit/abc123) Thanks [@developer](https://github.com/developer)! - Added Bearer token authentication support and fixed parser edge cases
```

## 5. 高级配置选项

### 5.1 自定义 changelog 生成器
```json
{
  "changelog": ["./custom-changelog.js", {
    "customOption": "value"
  }]
}
```

### 5.2 社区 changelog 生成器
```json
{
  "changelog": ["@changesets/changelog-git", {
    "showAuthor": true,
    "showDate": true
  }]
}
```

## 6. 本项目的最佳实践建议

### 6.1 更新配置
将当前的 `"repo": "user/repo-name"` 替换为实际仓库：
```json
{
  "changelog": ["@changesets/changelog-github", {
    "repo": "yourname/mcp-swagger-server"
  }]
}
```

### 6.2 安装依赖
```bash
pnpm add -D @changesets/changelog-github
```

### 6.3 验证配置
```bash
# 添加测试 changeset
pnpm changeset

# 生成版本和 changelog
pnpm changeset version

# 查看生成的 changelog
cat packages/mcp-swagger-server/CHANGELOG.md
```

## 7. 常见问题

### 7.1 链接不生成
- 检查 `repo` 配置是否正确
- 确保安装了 `@changesets/changelog-github`

### 7.2 格式不符合预期
- 检查 changeset 文件的格式
- 确保 commit 信息规范

### 7.3 依赖更新不显示
- 检查包之间的依赖关系
- 确保 workspace 配置正确

通过这样的配置，你的项目就能自动生成专业的、带有链接的 changelog，便于用户了解每次更新的内容。
