#!/usr/bin/env node

import { createMcpServer } from './server';

// Re-export main API and types from server
export { createMcpServer, runSseServer, runStdioServer, runStreamableServer } from './server';

// Re-export core layer
export * from './core';

// Re-export types
export * from './types';

// Re-export adapters
export * from './adapters/CLIAdapter';
export * from './adapters/ProgrammaticAdapter';

// Re-export compatibility layer
export * from './lib';

// Re-export transport utilities
export * from './transportUtils';

// Re-export CLI modules
export * from './cli/index';

// Import main function for direct execution
import { main, CliDesign } from './cli/index';

// If this file is run directly, start the server
if (require.main === module) {
  main().catch(error => {
    console.log();
    console.log(CliDesign.error(`严重错误: ${error.message}`));
    console.log(CliDesign.brand.muted(`  ${CliDesign.icons.boom} 服务器无法启动`));
    
    if (error.stack) {
      console.log(CliDesign.brand.muted(`  ${CliDesign.icons.list} 错误堆栈:`));
      console.log(CliDesign.brand.muted(error.stack.split('\n').slice(0, 5).join('\n')));
    }
    
    console.log();
    console.log(CliDesign.brand.muted(`  ${CliDesign.icons.bulb} 提示: 使用 --help 查看使用说明`));
    process.exit(1);
  });
}
