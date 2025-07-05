import { quickStart, createSwaggerMCPServer, createProgrammaticAPI } from './lib/factory';
import { CLIAdapter } from './adapters/CLIAdapter';
import { ProgrammaticAdapter } from './adapters/ProgrammaticAdapter';
import { ToolManager, Transformer, MCPRegistry } from './core';

/**
 * 示例用法演示
 */

// 示例1: 快速启动
async function example1() {
  console.log("=== 示例1: 快速启动 ===");
  await quickStart({
    name: 'demo-server',
    version: '1.0.0',
    swaggerFile: './swagger.json',
    transport: 'stdio'
  });
}

// 示例2: 使用完整配置
async function example2() {
  console.log("=== 示例2: 完整配置 ===");
  
  const serverFactory = await createSwaggerMCPServer({
    server: {
      name: 'advanced-server',
      version: '2.0.0',
      description: '高级MCP Swagger服务器'
    },
    swagger: {
      file: './petstore.json',
      transformOptions: {
        baseUrl: 'https://api.example.com',
        includeDeprecated: false,
        pathPrefix: '/api/v1'
      }
    },
    transport: {
      type: 'sse',
      options: {
        port: 3000,
        endpoint: '/sse'
      }
    }
  });

  console.log('服务器创建完成，准备启动...');
  // await serverFactory.start(); // 注释掉避免实际启动
}

// 示例3: 编程式API
async function example3() {
  console.log("=== 示例3: 编程式API ===");
  
  const api = createProgrammaticAPI({
    enableValidation: true,
    enableMetrics: true,
    maxCacheSize: 500
  });

  // 创建服务器
  const server = await api.createMCPServer(
    {
      openapi: '3.0.0',
      info: { title: 'Test API', version: '1.0.0' },
      paths: {}
    },
    {
      name: 'test-server',
      version: '1.0.0'
    }
  );

  console.log('编程式服务器创建完成');
  
  // 健康检查
  const health = await api.healthCheck();
  console.log('健康状态:', health.status);
}

// 示例4: 核心组件独立使用
async function example4() {
  console.log("=== 示例4: 核心组件 ===");
  
  const toolManager = new ToolManager();
  const transformer = new Transformer();
  const registry = new MCPRegistry();

  console.log('核心组件初始化完成');
  
  // 工具管理器统计
  const stats = toolManager.getStats();
  console.log('工具管理器统计:', stats);
}

// 运行示例（仅演示，不实际执行）
if (require.main === module) {
  console.log("MCP Swagger Server 分层架构示例");
  console.log("=".repeat(50));
  
  Promise.resolve()
    .then(() => example2())
    .then(() => example3())
    .then(() => example4())
    .then(() => {
      console.log("=".repeat(50));
      console.log("所有示例执行完成！");
    })
    .catch(console.error);
}

export {
  example1,
  example2,
  example3,
  example4
};
