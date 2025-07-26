import { AssistantType, TemplateCategory, TemplateStatus } from '../entities/ai-assistant-template.entity';

export const defaultTemplates = [
  {
    name: 'Claude Desktop MCP Server',
    description: '标准的Claude Desktop MCP服务器配置模板，支持文件系统、数据库和API工具',
    type: AssistantType.CLAUDE_DESKTOP,
    category: TemplateCategory.GENERAL,
    status: TemplateStatus.ACTIVE,
    configTemplate: {
      mcpServers: {
        '{{serverName}}': {
          command: '{{command}}',
          args: '{{args}}',
          env: '{{env}}'
        }
      }
    },
    defaultValues: {
      serverName: 'filesystem',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '/path/to/allowed/files'],
      env: {}
    },
    validationRules: {
      serverName: {
        type: 'string',
        required: true,
        pattern: '^[a-zA-Z0-9_-]+$'
      },
      command: {
        type: 'string',
        required: true
      },
      args: {
        type: 'object',
        required: true
      }
    },
    tags: ['claude', 'desktop', 'mcp', 'filesystem'],
    isPublic: true,
    version: '1.0.0',
    author: 'MCP Swagger Team',
    usageCount: 0,
    rating: 5.0
  },
  {
    name: 'OpenAI Assistant API',
    description: 'OpenAI Assistant API配置模板，支持自定义指令和工具集成',
    type: AssistantType.OPENAI_ASSISTANT,
    category: TemplateCategory.BUSINESS,
    status: TemplateStatus.ACTIVE,
    configTemplate: {
      apiKey: '{{apiKey}}',
      assistantId: '{{assistantId}}',
      instructions: '{{instructions}}',
      model: '{{model}}',
      tools: '{{tools}}',
      fileIds: '{{fileIds}}'
    },
    defaultValues: {
      model: 'gpt-4-turbo-preview',
      instructions: 'You are a helpful assistant.',
      tools: [],
      fileIds: []
    },
    validationRules: {
      apiKey: {
        type: 'string',
        required: true,
        pattern: '^sk-[a-zA-Z0-9]+$'
      },
      assistantId: {
        type: 'string',
        required: true,
        pattern: '^asst_[a-zA-Z0-9]+$'
      },
      instructions: {
        type: 'string',
        required: true
      },
      model: {
        type: 'string',
        required: true,
        enum: ['gpt-4-turbo-preview', 'gpt-4', 'gpt-3.5-turbo']
      }
    },
    tags: ['openai', 'assistant', 'api', 'gpt'],
    isPublic: true,
    version: '1.0.0',
    author: 'MCP Swagger Team',
    usageCount: 0,
    rating: 4.8
  },
  {
    name: 'Anthropic Claude API',
    description: 'Anthropic Claude API配置模板，支持高级对话和分析功能',
    type: AssistantType.ANTHROPIC_API,
    category: TemplateCategory.BUSINESS,
    status: TemplateStatus.ACTIVE,
    configTemplate: {
      apiKey: '{{apiKey}}',
      model: '{{model}}',
      maxTokens: '{{maxTokens}}',
      temperature: '{{temperature}}',
      systemPrompt: '{{systemPrompt}}'
    },
    defaultValues: {
      model: 'claude-3-sonnet-20240229',
      maxTokens: 4096,
      temperature: 0.7,
      systemPrompt: 'You are Claude, an AI assistant created by Anthropic.'
    },
    validationRules: {
      apiKey: {
        type: 'string',
        required: true,
        pattern: '^sk-ant-[a-zA-Z0-9]+$'
      },
      model: {
        type: 'string',
        required: true,
        enum: [
          'claude-3-opus-20240229',
          'claude-3-sonnet-20240229',
          'claude-3-haiku-20240307'
        ]
      },
      maxTokens: {
        type: 'number',
        required: true,
        min: 1,
        max: 8192
      },
      temperature: {
        type: 'number',
        min: 0,
        max: 1
      }
    },
    tags: ['anthropic', 'claude', 'api', 'conversation'],
    isPublic: true,
    version: '1.0.0',
    author: 'MCP Swagger Team',
    usageCount: 0,
    rating: 4.9
  },
  {
    name: 'Database MCP Server',
    description: '数据库MCP服务器配置模板，支持PostgreSQL、MySQL等数据库操作',
    type: AssistantType.CLAUDE_DESKTOP,
    category: TemplateCategory.DEVELOPMENT,
    status: TemplateStatus.ACTIVE,
    configTemplate: {
      mcpServers: {
        '{{serverName}}': {
          command: '{{command}}',
          args: '{{args}}',
          env: {
            DATABASE_URL: '{{databaseUrl}}'
          }
        }
      }
    },
    defaultValues: {
      serverName: 'database',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-postgres'],
      databaseUrl: 'postgresql://user:password@localhost:5432/database'
    },
    validationRules: {
      serverName: {
        type: 'string',
        required: true
      },
      databaseUrl: {
        type: 'string',
        required: true,
        pattern: '^(postgresql|mysql)://.*$'
      }
    },
    tags: ['database', 'postgresql', 'mysql', 'sql'],
    isPublic: true,
    version: '1.0.0',
    author: 'MCP Swagger Team',
    usageCount: 0,
    rating: 4.7
  },
  {
    name: 'Web Scraping MCP Server',
    description: '网页抓取MCP服务器配置模板，支持网页内容提取和分析',
    type: AssistantType.CLAUDE_DESKTOP,
    category: TemplateCategory.DEVELOPMENT,
    status: TemplateStatus.ACTIVE,
    configTemplate: {
      mcpServers: {
        '{{serverName}}': {
          command: '{{command}}',
          args: '{{args}}',
          env: {
            USER_AGENT: '{{userAgent}}',
            RATE_LIMIT: '{{rateLimit}}'
          }
        }
      }
    },
    defaultValues: {
      serverName: 'web-scraper',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-puppeteer'],
      userAgent: 'Mozilla/5.0 (compatible; MCP-WebScraper/1.0)',
      rateLimit: '1000'
    },
    validationRules: {
      serverName: {
        type: 'string',
        required: true
      },
      userAgent: {
        type: 'string',
        required: false
      },
      rateLimit: {
        type: 'string',
        pattern: '^[0-9]+$'
      }
    },
    tags: ['web', 'scraping', 'puppeteer', 'automation'],
    isPublic: true,
    version: '1.0.0',
    author: 'MCP Swagger Team',
    usageCount: 0,
    rating: 4.5
  },
  {
    name: 'Git Repository MCP Server',
    description: 'Git仓库MCP服务器配置模板，支持代码仓库操作和版本控制',
    type: AssistantType.CLAUDE_DESKTOP,
    category: TemplateCategory.DEVELOPMENT,
    status: TemplateStatus.ACTIVE,
    configTemplate: {
      mcpServers: {
        '{{serverName}}': {
          command: '{{command}}',
          args: '{{args}}',
          env: {
            GIT_REPO_PATH: '{{repoPath}}',
            GIT_BRANCH: '{{branch}}'
          }
        }
      }
    },
    defaultValues: {
      serverName: 'git',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-git'],
      repoPath: '/path/to/repository',
      branch: 'main'
    },
    validationRules: {
      serverName: {
        type: 'string',
        required: true
      },
      repoPath: {
        type: 'string',
        required: true
      },
      branch: {
        type: 'string',
        required: false
      }
    },
    tags: ['git', 'repository', 'version-control', 'development'],
    isPublic: true,
    version: '1.0.0',
    author: 'MCP Swagger Team',
    usageCount: 0,
    rating: 4.6
  },
  {
    name: 'Custom API Integration',
    description: '自定义API集成模板，支持REST API调用和数据处理',
    type: AssistantType.CUSTOM,
    category: TemplateCategory.DEVELOPMENT,
    status: TemplateStatus.ACTIVE,
    configTemplate: {
      apiEndpoint: '{{apiEndpoint}}',
      authentication: {
        type: '{{authType}}',
        apiKey: '{{apiKey}}',
        bearerToken: '{{bearerToken}}'
      },
      headers: '{{headers}}',
      timeout: '{{timeout}}',
      retryAttempts: '{{retryAttempts}}'
    },
    defaultValues: {
      authType: 'apiKey',
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000,
      retryAttempts: 3
    },
    validationRules: {
      apiEndpoint: {
        type: 'string',
        required: true,
        pattern: '^https?://.*$'
      },
      authType: {
        type: 'string',
        enum: ['apiKey', 'bearerToken', 'basic', 'none']
      },
      timeout: {
        type: 'number',
        min: 1000,
        max: 300000
      }
    },
    tags: ['api', 'integration', 'rest', 'custom'],
    isPublic: true,
    version: '1.0.0',
    author: 'MCP Swagger Team',
    usageCount: 0,
    rating: 4.3
  }
];