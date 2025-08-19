# MCP Swagger Server 交互式 CLI 实施方案

## 1. 项目概述

### 1.1 项目目标
将现有的 `mcp-swagger-server` 命令行工具升级为交互式 CLI，提供类似 Claude Code 或 Gemini CLI 的用户体验，支持：
- 交互式配置 OpenAPI 数据源
- 可视化设置操作过滤规则
- 会话管理和配置持久化
- 实时服务器状态监控
- 友好的错误处理和用户引导

### 1.2 项目范围
- **包含**：交互式 CLI 界面、会话管理、配置向导、实时监控
- **不包含**：现有核心功能的重构、API 接口的变更
- **兼容性**：完全向后兼容现有命令行参数和配置文件

### 1.3 成功标准
- 用户可以通过交互式界面完成所有配置
- 配置过程直观易懂，减少用户错误
- 启动时间不超过现有 CLI 的 2 倍
- 支持所有现有功能的交互式配置
- 通过完整的测试覆盖

## 2. 开发阶段规划

### 2.1 第一阶段：基础框架搭建（2-3 周）

#### 2.1.1 环境准备
**时间**：1-2 天

**任务清单**：
- [ ] 安装和配置新依赖包
- [ ] 设置开发环境和调试配置
- [ ] 创建项目结构和基础文件

**具体实现**：
```bash
# 安装新依赖
npm install inquirer@^9.2.0 ora@^7.0.0 boxen@^7.1.0 cli-table3@^0.6.3
npm install conf@^11.0.0 node-persist@^4.0.0 blessed@^0.1.81
npm install --save-dev @types/inquirer @types/blessed

# 创建目录结构
mkdir -p src/interactive-cli/{managers,wizards,ui,utils}
touch src/interactive-cli/index.ts
touch src/cli-interactive.ts
```

#### 2.1.2 核心框架开发
**时间**：5-7 天

**任务清单**：
- [ ] 实现 `InteractiveCLI` 主类
- [ ] 创建基础的菜单系统
- [ ] 实现会话管理基础功能
- [ ] 集成现有的服务器启动逻辑

**核心代码实现**：

`src/interactive-cli/index.ts`：
```typescript
import inquirer from 'inquirer';
import chalk from 'chalk';
import boxen from 'boxen';
import { SessionManager } from './managers/session-manager';
import { ServerManager } from './managers/server-manager';

export class InteractiveCLI {
  private sessionManager: SessionManager;
  private serverManager: ServerManager;
  private currentSession: InteractiveSession | null = null;

  constructor() {
    this.sessionManager = new SessionManager();
    this.serverManager = new ServerManager();
  }

  async start(): Promise<void> {
    console.clear();
    this.showWelcomeBanner();
    
    // 加载或创建会话
    this.currentSession = await this.sessionManager.loadOrCreateSession();
    
    // 主循环
    while (true) {
      const choice = await this.showMainMenu();
      await this.handleUserInput(choice);
    }
  }

  private showWelcomeBanner(): void {
    const banner = boxen(
      chalk.cyan.bold('🚀 MCP Swagger Server\n') +
      chalk.white('Interactive CLI v2.0\n\n') +
      chalk.gray('Transform OpenAPI specs into MCP tools with ease'),
      {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'cyan'
      }
    );
    console.log(banner);
  }

  private async showMainMenu(): Promise<string> {
    const choices = [
      { name: '🔧 配置 OpenAPI 数据源', value: 'configure-openapi' },
      { name: '🎯 设置操作过滤规则', value: 'configure-filters' },
      { name: '🔐 配置认证选项', value: 'configure-auth' },
      { name: '🌐 配置传输协议', value: 'configure-transport' },
      { name: '🚀 启动 MCP 服务器', value: 'start-server' },
      { name: '📊 查看服务器状态', value: 'server-status' },
      { name: '📝 管理会话历史', value: 'manage-sessions' },
      { name: '❌ 退出', value: 'exit' }
    ];

    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: '请选择操作:',
        choices,
        pageSize: 10
      }
    ]);

    return action;
  }

  private async handleUserInput(choice: string): Promise<void> {
    switch (choice) {
      case 'configure-openapi':
        await this.configureOpenAPI();
        break;
      case 'configure-filters':
        await this.configureFilters();
        break;
      case 'start-server':
        await this.startServer();
        break;
      case 'exit':
        await this.exit();
        break;
      default:
        console.log(chalk.yellow('功能开发中...'));
        await this.waitForKeyPress();
    }
  }

  private async waitForKeyPress(): Promise<void> {
    await inquirer.prompt([{
      type: 'input',
      name: 'continue',
      message: '按 Enter 继续...'
    }]);
  }

  private async exit(): Promise<void> {
    console.log(chalk.green('👋 感谢使用 MCP Swagger Server!'));
    process.exit(0);
  }
}
```

#### 2.1.3 会话管理实现
**时间**：3-4 天

`src/interactive-cli/managers/session-manager.ts`：
```typescript
import Conf from 'conf';
import { randomUUID } from 'crypto';

export interface InteractiveSession {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  config: SessionConfig;
  serverStatus: ServerStatus;
}

export class SessionManager {
  private config: Conf;
  private currentSessionId: string | null = null;

  constructor() {
    this.config = new Conf({
      projectName: 'mcp-swagger-server',
      schema: {
        sessions: {
          type: 'object',
          default: {}
        },
        currentSession: {
          type: 'string',
          default: ''
        }
      }
    });
  }

  async loadOrCreateSession(): Promise<InteractiveSession> {
    const currentId = this.config.get('currentSession') as string;
    
    if (currentId) {
      const session = this.loadSession(currentId);
      if (session) {
        return session;
      }
    }

    return this.createSession();
  }

  createSession(name?: string): InteractiveSession {
    const id = randomUUID();
    const session: InteractiveSession = {
      id,
      name: name || `Session ${new Date().toLocaleDateString()}`,
      createdAt: new Date(),
      updatedAt: new Date(),
      config: this.getDefaultConfig(),
      serverStatus: {
        running: false
      }
    };

    this.saveSession(session);
    this.currentSessionId = id;
    this.config.set('currentSession', id);
    
    return session;
  }

  saveSession(session: InteractiveSession): void {
    session.updatedAt = new Date();
    const sessions = this.config.get('sessions') as Record<string, InteractiveSession>;
    sessions[session.id] = session;
    this.config.set('sessions', sessions);
  }

  loadSession(id: string): InteractiveSession | null {
    const sessions = this.config.get('sessions') as Record<string, InteractiveSession>;
    return sessions[id] || null;
  }

  listSessions(): InteractiveSession[] {
    const sessions = this.config.get('sessions') as Record<string, InteractiveSession>;
    return Object.values(sessions).sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  private getDefaultConfig(): SessionConfig {
    return {
      openapi: {
        source: '',
        type: 'url',
        validated: false
      },
      transport: {
        type: 'stdio'
      },
      auth: {
        type: 'none'
      },
      filters: {
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        paths: [],
        operationIds: [],
        statusCodes: [],
        parameters: {
          include: [],
          exclude: []
        }
      },
      customHeaders: {}
    };
  }
}
```

### 2.2 第二阶段：配置向导开发（3-4 周）

#### 2.2.1 OpenAPI 配置向导
**时间**：1 周

**任务清单**：
- [ ] 实现 URL/文件路径输入和验证
- [ ] 集成现有的 OpenAPI 加载逻辑
- [ ] 添加 OpenAPI 内容预览功能
- [ ] 实现历史记录选择功能

`src/interactive-cli/wizards/openapi-wizard.ts`：
```typescript
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { existsSync } from 'fs';
import { isUrl } from '../utils/input-validator';
import { loadOpenAPIData } from '../../cli'; // 复用现有逻辑

export class OpenAPIWizard {
  async runWizard(currentConfig?: any): Promise<OpenAPIConfig> {
    console.log(chalk.cyan.bold('\n📄 OpenAPI 数据源配置\n'));

    const sourceType = await this.selectSourceType();
    let source: string;

    switch (sourceType) {
      case 'url':
        source = await this.inputURL();
        break;
      case 'file':
        source = await this.inputFilePath();
        break;
      case 'history':
        source = await this.selectFromHistory();
        break;
      default:
        throw new Error('Invalid source type');
    }

    // 验证和加载 OpenAPI
    const spinner = ora('正在验证 OpenAPI 规范...').start();
    try {
      const data = await loadOpenAPIData(source);
      spinner.succeed('OpenAPI 规范验证成功');
      
      // 显示 API 信息
      this.displayAPIInfo(data);
      
      return {
        source,
        type: sourceType as 'url' | 'file',
        validated: true,
        metadata: this.extractMetadata(data)
      };
    } catch (error) {
      spinner.fail(`OpenAPI 规范验证失败: ${error.message}`);
      
      const { retry } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'retry',
          message: '是否重新配置?',
          default: true
        }
      ]);
      
      if (retry) {
        return this.runWizard(currentConfig);
      } else {
        throw error;
      }
    }
  }

  private async selectSourceType(): Promise<string> {
    const { sourceType } = await inquirer.prompt([
      {
        type: 'list',
        name: 'sourceType',
        message: '请选择 OpenAPI 数据源类型:',
        choices: [
          { name: '🌐 远程 URL', value: 'url' },
          { name: '📁 本地文件', value: 'file' },
          { name: '📚 从历史记录选择', value: 'history' }
        ]
      }
    ]);
    return sourceType;
  }

  private async inputURL(): Promise<string> {
    const { url } = await inquirer.prompt([
      {
        type: 'input',
        name: 'url',
        message: '请输入 OpenAPI URL:',
        validate: (input: string) => {
          if (!input.trim()) {
            return '请输入有效的 URL';
          }
          if (!isUrl(input)) {
            return '请输入有效的 HTTP/HTTPS URL';
          }
          return true;
        }
      }
    ]);
    return url;
  }

  private async inputFilePath(): Promise<string> {
    const { filePath } = await inquirer.prompt([
      {
        type: 'input',
        name: 'filePath',
        message: '请输入文件路径:',
        validate: (input: string) => {
          if (!input.trim()) {
            return '请输入有效的文件路径';
          }
          if (!existsSync(input)) {
            return '文件不存在，请检查路径';
          }
          return true;
        }
      }
    ]);
    return filePath;
  }

  private displayAPIInfo(data: any): void {
    console.log(chalk.gray('\n📊 API 信息:'));
    if (data.info?.title) {
      console.log(chalk.white(`  标题: ${data.info.title}`));
    }
    if (data.info?.version) {
      console.log(chalk.white(`  版本: ${data.info.version}`));
    }
    if (data.paths) {
      const pathCount = Object.keys(data.paths).length;
      console.log(chalk.white(`  端点数量: ${pathCount}`));
    }
    console.log();
  }

  private extractMetadata(data: any): OpenAPIMetadata {
    return {
      title: data.info?.title || 'Unknown API',
      version: data.info?.version || '1.0.0',
      description: data.info?.description || '',
      pathCount: data.paths ? Object.keys(data.paths).length : 0,
      operationCount: this.countOperations(data.paths || {})
    };
  }

  private countOperations(paths: any): number {
    let count = 0;
    for (const path of Object.values(paths)) {
      const methods = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options'];
      for (const method of methods) {
        if ((path as any)[method]) {
          count++;
        }
      }
    }
    return count;
  }
}
```

#### 2.2.2 过滤器配置向导
**时间**：1 周

**任务清单**：
- [ ] 实现 HTTP 方法选择界面
- [ ] 实现路径过滤规则配置
- [ ] 实现参数过滤配置
- [ ] 添加过滤结果预览功能

#### 2.2.3 认证和传输协议配置
**时间**：1 周

**任务清单**：
- [ ] 实现认证类型选择和配置
- [ ] 实现传输协议选择和端口配置
- [ ] 集成现有的认证逻辑
- [ ] 添加配置验证功能

#### 2.2.4 配置预览和保存
**时间**：3-4 天

**任务清单**：
- [ ] 实现配置预览界面
- [ ] 实现配置导入导出功能
- [ ] 添加配置模板功能
- [ ] 实现配置验证和错误提示

### 2.3 第三阶段：服务器管理和监控（2-3 周）

#### 2.3.1 服务器启动和管理
**时间**：1 周

**任务清单**：
- [ ] 集成现有的服务器启动逻辑
- [ ] 实现服务器状态监控
- [ ] 添加服务器日志显示
- [ ] 实现服务器停止和重启功能

#### 2.3.2 实时监控界面
**时间**：1 周

**任务清单**：
- [ ] 实现实时状态显示
- [ ] 添加请求日志监控
- [ ] 实现性能指标显示
- [ ] 添加错误追踪功能

#### 2.3.3 高级功能
**时间**：3-5 天

**任务清单**：
- [ ] 实现配置热重载
- [ ] 添加服务器健康检查
- [ ] 实现自动重启功能
- [ ] 添加服务器性能优化建议

### 2.4 第四阶段：用户体验优化（1-2 周）

#### 2.4.1 界面美化和交互优化
**时间**：3-5 天

**任务清单**：
- [ ] 优化界面布局和颜色方案
- [ ] 添加动画和过渡效果
- [ ] 实现快捷键支持
- [ ] 优化错误提示和帮助信息

#### 2.4.2 性能优化
**时间**：2-3 天

**任务清单**：
- [ ] 优化启动时间
- [ ] 实现懒加载和缓存
- [ ] 优化内存使用
- [ ] 添加性能监控

#### 2.4.3 帮助系统和文档
**时间**：2-3 天

**任务清单**：
- [ ] 实现内置帮助系统
- [ ] 添加操作指南和示例
- [ ] 创建故障排除指南
- [ ] 更新项目文档

### 2.5 第五阶段：测试和发布（1-2 周）

#### 2.5.1 测试开发
**时间**：5-7 天

**任务清单**：
- [ ] 编写单元测试
- [ ] 实现集成测试
- [ ] 进行用户体验测试
- [ ] 执行兼容性测试

#### 2.5.2 文档和发布准备
**时间**：2-3 天

**任务清单**：
- [ ] 更新 README 和文档
- [ ] 准备发布说明
- [ ] 创建迁移指南
- [ ] 准备演示视频

## 3. 技术实现细节

### 3.1 项目结构调整

```
packages/mcp-swagger-server/
├── src/
│   ├── interactive-cli/           # 新增：交互式 CLI
│   │   ├── index.ts              # 主入口
│   │   ├── managers/             # 管理器
│   │   │   ├── session-manager.ts
│   │   │   ├── config-manager.ts
│   │   │   └── server-manager.ts
│   │   ├── wizards/              # 配置向导
│   │   │   ├── openapi-wizard.ts
│   │   │   ├── filter-wizard.ts
│   │   │   ├── auth-wizard.ts
│   │   │   └── transport-wizard.ts
│   │   ├── ui/                   # UI 组件
│   │   │   ├── menu-renderer.ts
│   │   │   ├── table-renderer.ts
│   │   │   ├── progress-renderer.ts
│   │   │   └── status-renderer.ts
│   │   └── utils/                # 工具函数
│   │       ├── input-validator.ts
│   │       ├── config-serializer.ts
│   │       └── history-manager.ts
│   ├── cli.ts                    # 现有 CLI（保持兼容）
│   ├── cli-interactive.ts        # 新增：交互式 CLI 入口
│   └── ...
├── package.json                  # 更新依赖
└── ...
```

### 3.2 依赖管理

#### 3.2.1 新增依赖
```json
{
  "dependencies": {
    "inquirer": "^9.2.0",
    "ora": "^7.0.0",
    "boxen": "^7.1.0",
    "cli-table3": "^0.6.3",
    "conf": "^11.0.0",
    "node-persist": "^4.0.0",
    "blessed": "^0.1.81",
    "chokidar": "^3.5.3"
  },
  "devDependencies": {
    "@types/inquirer": "^9.0.0",
    "@types/blessed": "^0.1.0"
  }
}
```

#### 3.2.2 脚本更新
```json
{
  "scripts": {
    "cli:interactive": "ts-node src/cli-interactive.ts",
    "cli:interactive:dev": "nodemon --exec ts-node src/cli-interactive.ts",
    "build:interactive": "tsc && chmod +x dist/cli-interactive.js"
  },
  "bin": {
    "mcp-swagger-server": "./dist/cli.js",
    "mcp-swagger": "./dist/cli.js",
    "mcp-swagger-interactive": "./dist/cli-interactive.js"
  }
}
```

### 3.3 配置数据结构

```typescript
// 类型定义
interface SessionConfig {
  openapi: {
    source: string;
    type: 'url' | 'file';
    validated: boolean;
    metadata?: OpenAPIMetadata;
  };
  transport: {
    type: 'stdio' | 'sse' | 'streamable';
    port?: number;
    endpoint?: string;
  };
  auth: {
    type: 'none' | 'bearer';
    bearer?: {
      token?: string;
      source: 'static' | 'env';
      envName?: string;
    };
  };
  filters: {
    methods: string[];
    paths: string[];
    operationIds: string[];
    statusCodes: number[];
    parameters: {
      include: string[];
      exclude: string[];
    };
  };
  customHeaders: Record<string, string>;
}

interface ServerStatus {
  running: boolean;
  pid?: number;
  startTime?: Date;
  url?: string;
  stats?: {
    requestCount: number;
    errorCount: number;
    avgResponseTime: number;
  };
}

interface OpenAPIMetadata {
  title: string;
  version: string;
  description: string;
  pathCount: number;
  operationCount: number;
}
```

## 4. 开发规范和最佳实践

### 4.1 代码规范
- **TypeScript**：严格类型检查，使用接口定义数据结构
- **ESLint**：遵循项目现有的代码风格
- **错误处理**：统一的错误处理机制，用户友好的错误信息
- **日志记录**：结构化日志，支持不同级别的日志输出

### 4.2 用户体验原则
- **渐进式披露**：复杂功能分步骤展示
- **即时反馈**：操作后立即给出反馈
- **错误恢复**：提供错误恢复建议和选项
- **一致性**：保持界面和交互的一致性

### 4.3 性能要求
- **启动时间**：< 3 秒
- **响应时间**：用户操作响应 < 500ms
- **内存使用**：< 100MB（正常运行）
- **CPU 使用**：空闲时 < 5%

## 5. 测试策略

### 5.1 单元测试
```typescript
// 示例：会话管理器测试
describe('SessionManager', () => {
  let sessionManager: SessionManager;
  
  beforeEach(() => {
    sessionManager = new SessionManager();
  });
  
  test('should create new session', () => {
    const session = sessionManager.createSession('Test Session');
    expect(session.name).toBe('Test Session');
    expect(session.id).toBeDefined();
  });
  
  test('should save and load session', () => {
    const session = sessionManager.createSession('Test Session');
    sessionManager.saveSession(session);
    
    const loaded = sessionManager.loadSession(session.id);
    expect(loaded).toEqual(session);
  });
});
```

### 5.2 集成测试
```typescript
// 示例：完整流程测试
describe('Interactive CLI Integration', () => {
  test('should complete full configuration flow', async () => {
    const cli = new InteractiveCLI();
    
    // 模拟用户输入
    const mockInputs = [
      'configure-openapi',
      'url',
      'https://petstore.swagger.io/v2/swagger.json',
      'configure-filters',
      // ... 更多输入
    ];
    
    // 执行测试
    // ...
  });
});
```

### 5.3 用户体验测试
- **可用性测试**：邀请真实用户测试界面和流程
- **A/B 测试**：测试不同的界面设计和交互方式
- **性能测试**：在不同环境下测试性能表现

## 6. 风险管理

### 6.1 技术风险
| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|----------|
| 依赖库兼容性问题 | 中 | 低 | 充分测试，准备备选方案 |
| 性能问题 | 高 | 中 | 早期性能测试，优化关键路径 |
| 跨平台兼容性 | 中 | 中 | 多平台测试，使用跨平台库 |

### 6.2 项目风险
| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|----------|
| 开发时间超期 | 高 | 中 | 分阶段开发，优先核心功能 |
| 用户接受度低 | 高 | 低 | 早期用户反馈，迭代改进 |
| 维护成本高 | 中 | 中 | 良好的代码结构，充分文档 |

### 6.3 应对策略
- **最小可行产品**：优先实现核心功能
- **用户反馈循环**：早期收集用户反馈
- **渐进式发布**：分阶段发布功能
- **回滚计划**：保持向后兼容性

## 7. 发布计划

### 7.1 版本规划
- **v2.0.0-alpha.1**：基础框架和会话管理
- **v2.0.0-alpha.2**：OpenAPI 配置向导
- **v2.0.0-beta.1**：完整的配置向导
- **v2.0.0-beta.2**：服务器管理和监控
- **v2.0.0-rc.1**：用户体验优化
- **v2.0.0**：正式发布

### 7.2 发布检查清单
- [ ] 所有功能测试通过
- [ ] 性能指标达标
- [ ] 文档更新完成
- [ ] 兼容性测试通过
- [ ] 用户反馈收集和处理
- [ ] 发布说明准备完成

## 8. 维护和支持

### 8.1 长期维护计划
- **Bug 修复**：及时响应和修复用户报告的问题
- **功能增强**：基于用户反馈持续改进
- **依赖更新**：定期更新依赖库
- **安全更新**：及时处理安全漏洞

### 8.2 用户支持
- **文档维护**：保持文档的准确性和完整性
- **社区支持**：积极参与社区讨论和问题解答
- **培训材料**：提供视频教程和最佳实践指南

## 9. 成功指标

### 9.1 技术指标
- **代码覆盖率**：> 80%
- **性能指标**：启动时间 < 3s，响应时间 < 500ms
- **错误率**：< 1%
- **兼容性**：支持 Node.js 16+ 和主流操作系统

### 9.2 用户指标
- **用户满意度**：> 4.5/5
- **功能完成率**：用户能够成功完成配置的比例 > 95%
- **错误恢复率**：用户能够从错误中恢复的比例 > 90%
- **学习曲线**：新用户完成首次配置的时间 < 10 分钟

## 10. 总结

这个实施方案提供了一个完整的路线图，将现有的 `mcp-swagger-server` CLI 升级为现代化的交互式工具。通过分阶段的开发方式，我们可以：

1. **降低风险**：分阶段开发，每个阶段都有明确的交付物
2. **保持兼容**：完全向后兼容现有功能
3. **提升体验**：提供直观、友好的用户界面
4. **确保质量**：通过完整的测试策略保证软件质量

预计总开发时间为 **8-12 周**，可以根据实际情况调整优先级和时间安排。建议先实现核心功能，然后根据用户反馈进行迭代改进。