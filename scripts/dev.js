const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const MonorepoBuildManager = require('./build');

class DevEnvironmentManager extends MonorepoBuildManager {
  async startDevelopment() {
    console.log('🚀 Starting terminal development environment...');
    
    try {
      console.log('📦 Building workspace packages...');
      await this.buildNonUIPackages();
      
      console.log('👀 Starting watch mode for workspace packages...');
      this.startWatchMode();
      
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
