# Monorepo 依赖管理与构建策略

## 概述

在 monorepo 架构中，包依赖管理是一个关键的技术挑战。本文档从架构师视角深入分析为什么需要预先构建所有依赖包，以及如何通过自动化构建脚本来优化开发体验。

## 1. 为什么要构建所有依赖包

### 1.1 依赖解析机制

在 monorepo 中，当一个包（如 `mcp-swagger-ui`）依赖另一个包（如 `@mcp-swagger/parser`）时，模块解析器需要找到实际的入口文件：

```json
// packages/mcp-swagger-ui/package.json
{
  "dependencies": {
    "@mcp-swagger/parser": "workspace:*"
  }
}
```

```json
// packages/mcp-swagger-parser/package.json
{
  "name": "@mcp-swagger/parser",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  }
}
```

**问题根源**: 如果 `dist/index.js` 不存在，模块解析器无法找到有效的入口点，导致构建失败。

### 1.2 TypeScript 编译链

```
源码 (src/*.ts) → 编译 (tsc) → 输出 (dist/*.js + *.d.ts)
                      ↑
                 必须完成这一步
```

在 TypeScript 项目中，源码位于 `src/` 目录，但包的入口点指向编译后的 `dist/` 目录。这创建了一个编译依赖链：

1. **开发时依赖**: 开发者在 `src/` 中编写源码
2. **运行时依赖**: 应用程序消费 `dist/` 中的编译产物
3. **类型依赖**: TypeScript 需要 `.d.ts` 文件进行类型检查

### 1.3 构建工具的依赖扫描

现代构建工具（如 Vite、Webpack）在启动时会进行依赖预扫描：

```javascript
// Vite 依赖扫描伪代码
function scanDependencies(entryPoints) {
  for (const entry of entryPoints) {
    const imports = parseImports(entry);
    for (const importPath of imports) {
      const resolved = resolvePackage(importPath);
      if (!resolved.exists) {
        throw new Error(`Failed to resolve entry for package "${importPath}"`);
      }
    }
  }
}
```

**失败场景**: 当扫描到 `@mcp-swagger/parser` 时，如果 `dist/index.js` 不存在，扫描失败，开发服务器无法启动。

## 2. 自动化构建脚本的优势

### 2.1 依赖拓扑排序

在复杂的 monorepo 中，包之间可能存在多层依赖关系：

```
┌─────────────────┐
│   Frontend UI   │
└─────────┬───────┘
          │ depends on
          ▼
┌─────────────────┐
│  Shared Parser  │
└─────────┬───────┘
          │ depends on
          ▼
┌─────────────────┐
│  Core Utilities │
└─────────────────┘
```

手动构建需要按顺序执行：
```bash
# 错误顺序 - 会失败
cd packages/frontend-ui && pnpm build  # ❌ 找不到 shared-parser
cd packages/shared-parser && pnpm build
cd packages/core-utilities && pnpm build

# 正确顺序
cd packages/core-utilities && pnpm build
cd packages/shared-parser && pnpm build
cd packages/frontend-ui && pnpm build
```

### 2.2 并行构建优化

自动化脚本可以分析依赖图，实现最优的并行构建：

```javascript
// 构建脚本示例
const buildPackages = async (packages) => {
  const dependencyGraph = analyzeDependencies(packages);
  const buildOrder = topologicalSort(dependencyGraph);
  
  for (const level of buildOrder) {
    // 同一层级的包可以并行构建
    await Promise.all(
      level.map(pkg => buildPackage(pkg))
    );
  }
};
```

## 3. 最佳实践案例

### 3.1 项目结构设计

```
mcp-swagger-server/
├── packages/
│   ├── core/                    # 基础工具包
│   │   ├── src/
│   │   ├── dist/               # 构建输出
│   │   └── package.json
│   ├── parser/                 # 解析器包
│   │   ├── src/
│   │   ├── dist/
│   │   └── package.json
│   └── ui/                     # 前端包
│       ├── src/
│       ├── dist/
│       └── package.json
├── scripts/
│   ├── build.js               # 统一构建脚本
│   ├── dev.js                 # 开发脚本
│   └── clean.js               # 清理脚本
├── package.json               # 根 package.json
└── pnpm-workspace.yaml
```

### 3.2 根级别 package.json 配置

```json
{
  "name": "mcp-swagger-server",
  "private": true,
  "scripts": {
    "build": "node scripts/build.js",
    "build:packages": "pnpm -r --filter='!./packages/ui' run build",
    "dev": "node scripts/dev.js",
    "dev:ui": "pnpm --filter=mcp-swagger-ui run dev",
    "clean": "pnpm -r run clean && rimraf node_modules",
    "postinstall": "pnpm run build:packages"
  },
  "devDependencies": {
    "rimraf": "^5.0.5",
    "concurrently": "^8.2.0"
  }
}
```

### 3.3 智能构建脚本

```javascript
// scripts/build.js
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

class MonorepoBuildManager {
  constructor() {
    this.packagesDir = path.join(__dirname, '../packages');
    this.packages = this.discoverPackages();
    this.dependencyGraph = this.buildDependencyGraph();
  }

  discoverPackages() {
    return fs.readdirSync(this.packagesDir)
      .filter(dir => {
        const packagePath = path.join(this.packagesDir, dir, 'package.json');
        return fs.existsSync(packagePath);
      })
      .map(dir => {
        const packagePath = path.join(this.packagesDir, dir, 'package.json');
        const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
        return {
          name: packageJson.name,
          path: path.join(this.packagesDir, dir),
          dependencies: this.extractWorkspaceDependencies(packageJson)
        };
      });
  }

  extractWorkspaceDependencies(packageJson) {
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    return Object.keys(deps).filter(dep => deps[dep].startsWith('workspace:'));
  }

  buildDependencyGraph() {
    const graph = new Map();
    
    for (const pkg of this.packages) {
      graph.set(pkg.name, {
        ...pkg,
        dependents: [],
        dependencies: pkg.dependencies
      });
    }

    // 建立依赖关系
    for (const pkg of this.packages) {
      for (const dep of pkg.dependencies) {
        if (graph.has(dep)) {
          graph.get(dep).dependents.push(pkg.name);
        }
      }
    }

    return graph;
  }

  topologicalSort() {
    const visited = new Set();
    const result = [];
    const visiting = new Set();

    const visit = (pkgName) => {
      if (visiting.has(pkgName)) {
        throw new Error(`Circular dependency detected: ${pkgName}`);
      }
      if (visited.has(pkgName)) return;

      visiting.add(pkgName);
      const pkg = this.dependencyGraph.get(pkgName);
      
      for (const dep of pkg.dependencies) {
        if (this.dependencyGraph.has(dep)) {
          visit(dep);
        }
      }

      visiting.delete(pkgName);
      visited.add(pkgName);
      result.push(pkg);
    };

    for (const pkgName of this.dependencyGraph.keys()) {
      visit(pkgName);
    }

    return result;
  }

  async buildPackage(pkg) {
    console.log(`🔨 Building ${pkg.name}...`);
    const startTime = Date.now();
    
    try {
      execSync('pnpm run build', { 
        cwd: pkg.path, 
        stdio: 'inherit' 
      });
      
      const duration = Date.now() - startTime;
      console.log(`✅ ${pkg.name} built successfully (${duration}ms)`);
    } catch (error) {
      console.error(`❌ Failed to build ${pkg.name}:`, error.message);
      throw error;
    }
  }

  async buildAll() {
    console.log('📦 Starting monorepo build...');
    const buildOrder = this.topologicalSort();
    
    console.log('📋 Build order:', buildOrder.map(p => p.name).join(' → '));

    for (const pkg of buildOrder) {
      await this.buildPackage(pkg);
    }

    console.log('🎉 All packages built successfully!');
  }
}

// 执行构建
if (require.main === module) {
  new MonorepoBuildManager().buildAll().catch(error => {
    console.error('💥 Build failed:', error);
    process.exit(1);
  });
}

module.exports = MonorepoBuildManager;
```

### 3.4 开发环境脚本

```javascript
// scripts/dev.js
const { spawn } = require('child_process');
const MonorepoBuildManager = require('./build');

class DevEnvironmentManager extends MonorepoBuildManager {
  async startDevelopment() {
    console.log('🚀 Starting development environment...');
    
    // 1. 首先构建所有依赖包（除了前端）
    await this.buildNonUIPackages();
    
    // 2. 启动 watch 模式
    this.startWatchMode();
    
    // 3. 启动前端开发服务器
    this.startUIDevServer();
  }

  async buildNonUIPackages() {
    const nonUIPackages = this.topologicalSort()
      .filter(pkg => !pkg.name.includes('ui'));
    
    for (const pkg of nonUIPackages) {
      await this.buildPackage(pkg);
    }
  }

  startWatchMode() {
    const watchPackages = this.packages
      .filter(pkg => !pkg.name.includes('ui'))
      .filter(pkg => this.hasWatchScript(pkg));

    for (const pkg of watchPackages) {
      console.log(`👀 Starting watch mode for ${pkg.name}`);
      const child = spawn('pnpm', ['run', 'build:watch'], {
        cwd: pkg.path,
        stdio: 'inherit'
      });
      
      child.on('error', (error) => {
        console.error(`Watch failed for ${pkg.name}:`, error);
      });
    }
  }

  startUIDevServer() {
    const uiPackage = this.packages.find(pkg => pkg.name.includes('ui'));
    if (uiPackage) {
      console.log(`🌐 Starting UI dev server for ${uiPackage.name}`);
      const child = spawn('pnpm', ['run', 'dev'], {
        cwd: uiPackage.path,
        stdio: 'inherit'
      });
    }
  }

  hasWatchScript(pkg) {
    const packageJsonPath = path.join(pkg.path, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    return packageJson.scripts && 
           (packageJson.scripts['build:watch'] || packageJson.scripts['dev']);
  }
}

if (require.main === module) {
  new DevEnvironmentManager().startDevelopment().catch(error => {
    console.error('💥 Development startup failed:', error);
    process.exit(1);
  });
}
```

### 3.5 Package.json 最佳实践

```json
// packages/parser/package.json
{
  "name": "@mcp-swagger/parser",
  "version": "0.1.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsc",
    "build:watch": "tsc --watch",
    "clean": "rimraf dist",
    "prepublishOnly": "pnpm run build"
  },
  "dependencies": {
    "@apidevtools/swagger-parser": "^10.1.0"
  },
  "devDependencies": {
    "typescript": "^5.2.0",
    "rimraf": "^5.0.5"
  }
}
```

## 4. 高级架构模式

### 4.1 增量构建优化

```javascript
// scripts/incremental-build.js
class IncrementalBuildManager extends MonorepoBuildManager {
  constructor() {
    super();
    this.buildCache = this.loadBuildCache();
  }

  async buildWithCache() {
    const changedPackages = await this.detectChanges();
    const affectedPackages = this.getAffectedPackages(changedPackages);
    
    console.log(`📈 Incremental build: ${affectedPackages.length} packages affected`);
    
    for (const pkg of this.sortPackages(affectedPackages)) {
      await this.buildPackage(pkg);
      this.updateBuildCache(pkg);
    }
  }

  async detectChanges() {
    // 使用 git 或文件时间戳检测变更
    const { execSync } = require('child_process');
    const changedFiles = execSync('git diff --name-only HEAD~1', { encoding: 'utf8' })
      .split('\n')
      .filter(Boolean);
    
    return this.mapFilesToPackages(changedFiles);
  }

  getAffectedPackages(changedPackages) {
    const affected = new Set(changedPackages);
    
    // 添加依赖于变更包的所有包
    for (const changedPkg of changedPackages) {
      this.addDependents(changedPkg, affected);
    }
    
    return Array.from(affected);
  }
}
```

### 4.2 CI/CD 集成

```yaml
# .github/workflows/build.yml
name: Monorepo Build

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
      with:
        fetch-depth: 0  # 需要完整历史用于增量构建
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'pnpm'
    
    - name: Install pnpm
      run: npm install -g pnpm
    
    - name: Install dependencies
      run: pnpm install --frozen-lockfile
    
    - name: Build packages
      run: pnpm run build
    
    - name: Run tests
      run: pnpm run test
    
    - name: Cache build artifacts
      uses: actions/cache@v3
      with:
        path: packages/*/dist
        key: build-${{ github.sha }}
```

## 5. 性能优化策略

### 5.1 构建性能监控

```javascript
// scripts/build-analytics.js
class BuildAnalytics {
  static trackBuildTime(packageName, buildFn) {
    return async (...args) => {
      const startTime = process.hrtime.bigint();
      const startMemory = process.memoryUsage();
      
      try {
        const result = await buildFn(...args);
        
        const endTime = process.hrtime.bigint();
        const endMemory = process.memoryUsage();
        
        const duration = Number(endTime - startTime) / 1000000; // ms
        const memoryDelta = endMemory.heapUsed - startMemory.heapUsed;
        
        this.recordMetrics(packageName, {
          duration,
          memoryDelta,
          success: true
        });
        
        return result;
      } catch (error) {
        this.recordMetrics(packageName, {
          duration: Number(process.hrtime.bigint() - startTime) / 1000000,
          success: false,
          error: error.message
        });
        throw error;
      }
    };
  }
  
  static recordMetrics(packageName, metrics) {
    const timestamp = new Date().toISOString();
    console.log(`📊 Build metrics for ${packageName}:`, {
      timestamp,
      ...metrics
    });
    
    // 可以发送到监控系统
    // sendToMetrics(packageName, metrics);
  }
}
```

### 5.2 内存优化

```javascript
// scripts/memory-optimized-build.js
class MemoryOptimizedBuilder extends MonorepoBuildManager {
  async buildAll() {
    const buildOrder = this.topologicalSort();
    
    // 分批构建以控制内存使用
    const batchSize = 3;
    for (let i = 0; i < buildOrder.length; i += batchSize) {
      const batch = buildOrder.slice(i, i + batchSize);
      
      await Promise.all(
        batch.map(pkg => this.buildWithMemoryControl(pkg))
      );
      
      // 强制垃圾回收
      if (global.gc) {
        global.gc();
      }
    }
  }
  
  async buildWithMemoryControl(pkg) {
    const memoryBefore = process.memoryUsage();
    
    await this.buildPackage(pkg);
    
    const memoryAfter = process.memoryUsage();
    const memoryDelta = memoryAfter.heapUsed - memoryBefore.heapUsed;
    
    if (memoryDelta > 100 * 1024 * 1024) { // 100MB
      console.warn(`⚠️  High memory usage detected for ${pkg.name}: ${memoryDelta / 1024 / 1024}MB`);
    }
  }
}
```

## 6. 故障排除指南

### 6.1 常见问题诊断

```javascript
// scripts/diagnostic.js
class MonorepoDiagnostic {
  static async diagnose() {
    console.log('🔍 Running monorepo diagnostic...');
    
    await Promise.all([
      this.checkPackageStructure(),
      this.checkDependencyIntegrity(),
      this.checkBuildArtifacts(),
      this.checkCircularDependencies()
    ]);
  }
  
  static async checkPackageStructure() {
    console.log('📋 Checking package structure...');
    // 实现包结构检查逻辑
  }
  
  static async checkDependencyIntegrity() {
    console.log('🔗 Checking dependency integrity...');
    // 检查 workspace 依赖是否正确
  }
  
  static async checkBuildArtifacts() {
    console.log('🏗️  Checking build artifacts...');
    // 验证构建产物是否存在且有效
  }
  
  static async checkCircularDependencies() {
    console.log('🔄 Checking for circular dependencies...');
    // 检测循环依赖
  }
}
```

### 6.2 自动修复脚本

```javascript
// scripts/auto-fix.js
class MonorepoAutoFix {
  static async fixCommonIssues() {
    console.log('🔧 Running auto-fix...');
    
    await this.cleanStaleArtifacts();
    await this.rebuildBrokenPackages();
    await this.updateWorkspaceDependencies();
  }
  
  static async cleanStaleArtifacts() {
    console.log('🧹 Cleaning stale build artifacts...');
    // 清理过期的构建产物
  }
  
  static async rebuildBrokenPackages() {
    console.log('🔨 Rebuilding broken packages...');
    // 重新构建有问题的包
  }
}
```

## 7. 总结

在 monorepo 架构中，包依赖管理不仅仅是技术实现问题，更是架构设计的核心考量：

1. **预先构建的必要性**: 源于现代 JavaScript 生态系统的模块解析机制和构建工具的依赖扫描行为
2. **自动化构建脚本**: 提供了可扩展、可维护的解决方案，支持复杂的依赖关系和并行优化
3. **架构层面的收益**: 
   - 开发体验的一致性
   - 构建过程的可预测性
   - 团队协作的效率提升
   - 持续集成的稳定性

通过合理的工具链设计和自动化脚本，我们可以将复杂的依赖管理问题转化为简单的开发者体验，这正是优秀架构设计的核心价值所在。

---

*本文档基于实际项目经验总结，持续更新优化。如有问题或建议，请提交 Issue 或 PR。*
