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
          dependencies: this.extractWorkspaceDependencies(packageJson),
          hasBuilScript: !!(packageJson.scripts && packageJson.scripts.build)
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

    return result.filter(pkg => pkg.hasBuilScript);
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
      return true;
    } catch (error) {
      console.error(`❌ Failed to build ${pkg.name}:`, error.message);
      throw error;
    }
  }

  async buildAll() {
    console.log('📦 Starting monorepo build...');
    console.log('📋 Discovered packages:', this.packages.map(p => p.name).join(', '));
    
    const buildOrder = this.topologicalSort();
    
    if (buildOrder.length === 0) {
      console.log('ℹ️  No packages with build scripts found.');
      return;
    }
    
    console.log('📋 Build order:', buildOrder.map(p => p.name).join(' → '));

    for (const pkg of buildOrder) {
      await this.buildPackage(pkg);
    }

    console.log('🎉 All packages built successfully!');
  }

  async buildNonUIPackages() {
    console.log('📦 Building non-UI packages...');
    const buildOrder = this.topologicalSort()
      .filter(pkg => !pkg.name.includes('ui') && !pkg.name.includes('UI'));
    
    if (buildOrder.length === 0) {
      console.log('ℹ️  No non-UI packages with build scripts found.');
      return;
    }

    console.log('📋 Non-UI build order:', buildOrder.map(p => p.name).join(' → '));

    for (const pkg of buildOrder) {
      await this.buildPackage(pkg);
    }

    console.log('✅ All non-UI packages built successfully!');
  }
}

// 执行构建
if (require.main === module) {
  const args = process.argv.slice(2);
  const manager = new MonorepoBuildManager();
  
  if (args.includes('--non-ui')) {
    manager.buildNonUIPackages().catch(error => {
      console.error('💥 Build failed:', error);
      process.exit(1);
    });
  } else {
    manager.buildAll().catch(error => {
      console.error('💥 Build failed:', error);
      process.exit(1);
    });
  }
}

module.exports = MonorepoBuildManager;
