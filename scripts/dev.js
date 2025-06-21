const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const MonorepoBuildManager = require('./build');

class DevEnvironmentManager extends MonorepoBuildManager {
  async startDevelopment() {
    console.log('🚀 Starting development environment...');
    
    try {
      // 1. 首先构建所有依赖包（除了前端）
      console.log('📦 Building dependencies...');
      await this.buildNonUIPackages();
      
      // 2. 启动 watch 模式
      console.log('👀 Starting watch mode for packages...');
      this.startWatchMode();
      
      // 等待一秒让 watch 模式启动
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 3. 启动前端开发服务器
      console.log('🌐 Starting UI development server...');
      this.startUIDevServer();
      
    } catch (error) {
      console.error('💥 Failed to start development environment:', error);
      process.exit(1);
    }
  }

  startWatchMode() {
    const watchPackages = this.packages
      .filter(pkg => !pkg.name.includes('ui') && !pkg.name.includes('UI'))
      .filter(pkg => this.hasWatchScript(pkg));

    if (watchPackages.length === 0) {
      console.log('ℹ️  No packages with watch scripts found.');
      return;
    }

    for (const pkg of watchPackages) {
      console.log(`👀 Starting watch mode for ${pkg.name}`);
      
      const watchScript = this.getWatchScript(pkg);
      const [command, ...args] = watchScript.split(' ');
      
      const child = spawn(command, args, {
        cwd: pkg.path,
        stdio: ['ignore', 'inherit', 'inherit']
      });
      
      child.on('error', (error) => {
        console.error(`❌ Watch failed for ${pkg.name}:`, error);
      });

      child.on('close', (code) => {
        if (code !== 0) {
          console.error(`❌ Watch process exited with code ${code} for ${pkg.name}`);
        }
      });
    }
  }

  startUIDevServer() {
    const uiPackage = this.packages.find(pkg => 
      pkg.name.includes('ui') || pkg.name.includes('UI')
    );
    
    if (!uiPackage) {
      console.log('ℹ️  No UI package found.');
      return;
    }

    console.log(`🌐 Starting UI dev server for ${uiPackage.name}`);
    
    const child = spawn('pnpm', ['run', 'dev'], {
      cwd: uiPackage.path,
      stdio: 'inherit'
    });

    child.on('error', (error) => {
      console.error(`❌ UI dev server failed:`, error);
    });

    child.on('close', (code) => {
      if (code !== 0) {
        console.error(`❌ UI dev server exited with code ${code}`);
      }
    });

    // 优雅关闭处理
    process.on('SIGINT', () => {
      console.log('\\n🛑 Shutting down development environment...');
      child.kill('SIGINT');
      process.exit(0);
    });
  }

  hasWatchScript(pkg) {
    const packageJsonPath = path.join(pkg.path, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    return packageJson.scripts && 
           (packageJson.scripts['build:watch'] || 
            packageJson.scripts['dev'] || 
            packageJson.scripts['watch']);
  }

  getWatchScript(pkg) {
    const packageJsonPath = path.join(pkg.path, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    if (packageJson.scripts['build:watch']) {
      return 'pnpm run build:watch';
    } else if (packageJson.scripts['watch']) {
      return 'pnpm run watch';
    } else if (packageJson.scripts['dev']) {
      return 'pnpm run dev';
    }
    
    return 'pnpm run build:watch';
  }
}

if (require.main === module) {
  new DevEnvironmentManager().startDevelopment();
}

module.exports = DevEnvironmentManager;
