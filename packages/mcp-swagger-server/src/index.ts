// Library entrypoint: exports only (no side effects)
export { createMcpServer, runSseServer, runStdioServer, runStreamableServer } from './server';
export * from './core';
export * from './types';
export { transformOpenApiToMcpTools } from './transform/transformOpenApiToMcpTools';
export * from './adapters/CLIAdapter';
export * from './adapters/ProgrammaticAdapter';
export * from './lib';
export * from './transportUtils';

// Delegate CLI execution to the dedicated CLI module
if (require.main === module) {
  import('./cli')
    .then(({ main }) => main())
    .catch((error) => {
      console.error('CLI 启动失败:', error);
      process.exit(1);
    });
}
