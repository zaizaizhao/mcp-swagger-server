import * as fs from 'fs';
import * as path from 'path';
import { CliDesign } from './design';
import { ConfigFile } from './types';

export function loadConfigFile(configPath: string): ConfigFile {
  try {
    console.error(CliDesign.loading(`正在加载配置文件...`));
    console.error(CliDesign.brand.muted(`  ${CliDesign.icons.file} ${path.resolve(configPath)}`));
    
    const content = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(content);
    
    console.error(CliDesign.success('配置文件加载成功'));
    return config;
  } catch (error: any) {
    console.error(CliDesign.error(`加载配置文件失败: ${error.message}`));
    throw error;
  }
}

export function loadEnvFile(envPath: string): Record<string, string> {
  try {
    console.error(CliDesign.loading(`正在加载 .env 文件...`));
    console.error(CliDesign.brand.muted(`  ${CliDesign.icons.file} ${path.resolve(envPath)}`));
    
    const content = fs.readFileSync(envPath, 'utf-8');
    const envVars: Record<string, string> = {};
    
    content.split('\n').forEach(line => {
      line = line.trim();
      if (line && !line.startsWith('#') && line.includes('=')) {
        const [key, ...valueParts] = line.split('=');
        const value = valueParts.join('=').trim();
        envVars[key.trim()] = value.replace(/^["']|["']$/g, '');
      }
    });
    
    console.error(CliDesign.success(`.env 文件加载成功，加载了 ${Object.keys(envVars).length} 个环境变量`));
    return envVars;
  } catch (error: any) {
    console.error(CliDesign.error(`加载 .env 文件失败: ${error.message}`));
    throw error;
  }
}
