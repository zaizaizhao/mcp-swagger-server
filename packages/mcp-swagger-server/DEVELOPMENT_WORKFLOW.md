# 开发与发布工作流指南

本文档说明如何在开发时使用本地依赖，在发布时使用正常版本号。

## 🛠️ 开发模式

### 当前状态
项目已配置为使用 pnpm workspace，`mcp-swagger-parser` 依赖设置为 `workspace:*`，这意味着：
- ✅ 自动使用本地的 `../mcp-swagger-parser` 代码
- ✅ 修改 `mcp-swagger-parser` 后无需重新安装
- ✅ 支持实时开发和调试

### 验证开发环境
```bash
# 验证本地依赖链接
ls -la node_modules/mcp-swagger-parser
# 应该显示: ... -> ../../mcp-swagger-parser

# 验证功能正常
node verify-annotations.js
```

## 📦 发布模式

### 发布前准备
在提交代码或发布之前，运行：
```bash
pnpm run prepare:release
```

这个命令会：
- 🔄 将 `"mcp-swagger-parser": "workspace:*"` 替换为具体版本号（如 `"1.0.4"`）
- ✅ 生成适合发布的 package.json

### 发布后恢复开发模式
发布完成后，恢复开发依赖：
```bash
pnpm run dev:deps
pnpm install  # 重新建立 workspace 链接
```

## 🔄 完整工作流

### 日常开发
```bash
# 1. 确保使用 workspace 依赖
pnpm run dev:deps
pnpm install

# 2. 开发和测试
# 修改 mcp-swagger-parser 或 mcp-swagger-server 代码
npm run build
node verify-annotations.js

# 3. 运行测试
npm run test  # 如果有测试的话
```

### 准备发布
```bash
# 1. 确保所有更改已提交
git status

# 2. 准备发布版本
pnpm run prepare:release

# 3. 检查 package.json 是否正确
grep "mcp-swagger-parser" package.json
# 应该显示具体版本号，如: "mcp-swagger-parser": "1.0.4",

# 4. 构建和发布
npm run build
npm publish

# 5. 发布后恢复开发模式
pnpm run dev:deps
pnpm install
```

## 📋 脚本说明

| 脚本 | 功能 | 何时使用 |
|------|------|----------|
| `pnpm run dev:deps` | 恢复 workspace 依赖 | 开发时、克隆项目后 |
| `pnpm run prepare:release` | 准备发布版本 | 发布前 |
| `node verify-annotations.js` | 验证功能正常 | 开发时测试 |

## ⚠️ 注意事项

1. **不要将发布模式的 package.json 提交到 git**
   - 发布前运行 `prepare:release`
   - 发布后立即运行 `dev:deps` 恢复

2. **确保版本号同步**
   - `mcp-swagger-parser` 更新版本时，发布脚本会自动使用最新版本

3. **团队协作**
   - 其他开发者克隆项目后，运行 `pnpm install` 即可自动建立 workspace 链接
   - 如果遇到问题，运行 `pnpm run dev:deps && pnpm install`

## 🎯 最佳实践

1. **开发分支**: 始终保持 `workspace:*` 依赖
2. **发布分支**: 临时使用具体版本号
3. **自动化**: 可以在 CI/CD 中集成这些脚本
4. **版本管理**: 确保 `mcp-swagger-parser` 版本号及时更新

---

通过这种方式，你可以享受 monorepo 开发的便利，同时保证发布的包具有正确的依赖版本。
