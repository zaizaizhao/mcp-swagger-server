import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import chokidar from 'chokidar';
import yaml from 'js-yaml';
import { isUrl } from '../utils/common';
import { CliDesign } from './design';

export async function loadOpenAPIData(source: string): Promise<any> {
  try {
    const parseContent = (raw: string) => {
      const trimmed = raw.trim();
      if (!trimmed) {
        throw new Error('OpenAPI 内容为空');
      }
      try {
        return JSON.parse(trimmed);
      } catch {
        return yaml.load(trimmed);
      }
    };

    if (isUrl(source)) {
      console.log(CliDesign.loading(`正在从远程 URL 加载 OpenAPI 规范...`));
      console.log(CliDesign.brand.muted(`  ${CliDesign.icons.signal} ${source}`));
      const response = await axios.get(source, { timeout: 10000 });
      console.log(CliDesign.success('远程 OpenAPI 规范加载成功'));
      if (typeof response.data === 'string') {
        return parseContent(response.data);
      }
      return response.data;
    } else {
      console.log(CliDesign.loading(`正在从本地文件加载 OpenAPI 规范...`));
      const filePath = path.resolve(source);
      console.log(CliDesign.brand.muted(`  ${CliDesign.icons.file} ${filePath}`));
      const content = fs.readFileSync(filePath, 'utf-8');
      
      console.log(CliDesign.brand.muted(`  ${CliDesign.icons.process} 解析 OpenAPI 内容...`));
      const data = parseContent(content);
      console.log(CliDesign.success('本地 OpenAPI 规范加载成功'));
      return data;
    }
  } catch (error: any) {
    console.log(CliDesign.error(`加载 OpenAPI 规范失败: ${error.message}`));
    console.log(CliDesign.brand.muted(`  源: ${source}`));
    throw error;
  }
}

export function watchOpenAPIFile(filePath: string, callback: () => void) {
  if (!isUrl(filePath)) {
    const resolvedPath = path.resolve(filePath);
    console.log(CliDesign.info('文件监控已启用'));
    console.log(CliDesign.brand.muted(`  ${CliDesign.icons.eye} 监控文件: ${resolvedPath}`));
    
    const watcher = chokidar.watch(resolvedPath, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 300,
        pollInterval: 100
      }
    });

    watcher.on('change', () => {
      console.log('\n' + CliDesign.warning('检测到文件变化！'));
      console.log(CliDesign.brand.muted(`  ${CliDesign.icons.clock} ${new Date().toLocaleTimeString()}: ${path.basename(filePath)} 已更新`));
      console.log(CliDesign.loading('正在重启服务器...'));
      watcher.close();
      callback();
    });

    watcher.on('error', (error) => {
      console.log(CliDesign.error(`文件监控错误: ${error.message}`));
    });
  }
}
