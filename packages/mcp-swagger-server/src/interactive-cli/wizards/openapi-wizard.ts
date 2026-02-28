import inquirer from 'inquirer';
import { promises as fs } from 'fs';
import axios from 'axios';
import yaml from 'js-yaml';
import { OpenAPIV3 } from 'openapi-types';
import {
  SessionConfig,
  TransportType,
  AuthConfig,
  OperationFilter,
  OpenAPIValidationResult,
  PresetOpenAPIUrl,
  WizardContext,
  InterfaceSelectionConfig
} from '../types/index';
import { InterfaceSelector } from '../components/interface-selector';
import type { CustomHeaders } from 'mcp-swagger-parser';

/**
 * OpenAPI 配置向导
 * 引导用户完成 OpenAPI 到 MCP 服务的配置过程
 */
export class OpenAPIWizard {
  private inquirer = inquirer;
  private presetUrls: PresetOpenAPIUrl[] = [
    {
      name: 'Swagger Petstore',
      url: 'https://petstore.swagger.io/v2/swagger.json',
      description: 'Swagger Petstore API 示例',
      category: 'example'
    },
    {
      name: 'GitHub API',
      url: 'https://api.github.com/openapi.yaml',
      description: 'GitHub REST API v3',
      category: 'real'
    }
  ];

  /**
   * 运行配置向导
   */
  async runWizard(): Promise<SessionConfig | null> {
    console.log('\n🚀 欢迎使用 OpenAPI 配置向导！\n');
    
    try {
      const context: WizardContext = {
      sessionConfig: {},
      wizardState: {
        currentStep: 0,
        totalSteps: 4,
        stepStates: {},
        canGoBack: false,
        canGoForward: false
      },
      currentStep: 0,
      steps: [
        { id: 'basic', title: '基本信息', required: true, completed: false },
        { id: 'openapi', title: 'OpenAPI 配置', required: true, completed: false },
        { id: 'transport', title: '传输配置', required: true, completed: false },
        { id: 'advanced', title: '高级配置', required: false, completed: false }
      ],
      data: {},
      isEditing: false
    };

      // 步骤 1: 获取基本信息
      const basicInfo = await this.getBasicInfo();
      if (!basicInfo) return null;
      context.data = { ...context.data, ...basicInfo };

      // 步骤 2: 配置 OpenAPI
      const openApiConfig = await this.getOpenAPIConfig();
      if (!openApiConfig) return null;
      context.data = { ...context.data, ...openApiConfig };
      
      // 步骤 3: 配置传输
      const transportConfig = await this.getTransportConfig();
      if (!transportConfig) return null;
      context.data = { ...context.data, ...transportConfig };

      // 步骤 4: 高级配置（可选）
      const wantAdvanced = await this.inquirer.prompt([
        {
          type: 'confirm',
          name: 'configure',
          message: '是否要配置高级选项（认证、过滤器等）？',
          default: false
        }
      ]);

      if (wantAdvanced.configure) {
        const advancedConfig = await this.getAdvancedConfig();
        if (advancedConfig) {
          context.data = { ...context.data, ...advancedConfig };
        }
      }

      // 生成最终配置
      const finalConfig: Omit<SessionConfig, 'id' | 'createdAt' | 'lastUsed'> = {
        name: context.data.name!,
        description: context.data.description,
        openApiUrl: context.data.openApiUrl!,
        transport: context.data.transport!,
        port: context.data.port,
        host: context.data.host,
        auth: context.data.auth,
        customHeaders: context.data.customHeaders,
        operationFilter: context.data.operationFilter,
        interfaceSelection: context.data.interfaceSelection
      };

      // 显示配置摘要
      console.log('\n📋 配置摘要:');
      console.log(`名称: ${finalConfig.name}`);
      console.log(`描述: ${finalConfig.description || '无'}`);
      console.log(`OpenAPI URL: ${finalConfig.openApiUrl}`);
      console.log(`传输协议: ${finalConfig.transport}`);
      if (finalConfig.port) console.log(`端口: ${finalConfig.port}`);
      if (finalConfig.host) console.log(`主机: ${finalConfig.host}`);
      if (finalConfig.auth) console.log(`认证: ${finalConfig.auth.type}`);

      const confirm = await this.inquirer.prompt([
        {
          type: 'confirm',
          name: 'save',
          message: '确认保存此配置？',
          default: true
        }
      ]);

      return confirm.save ? finalConfig as SessionConfig : null;
    } catch (error) {
      console.error('配置向导出错:', error);
      return null;
    }
  }

  /**
   * 编辑现有配置
   */
  async editConfiguration(config: SessionConfig): Promise<SessionConfig | null> {
    console.log(`\n✏️  编辑配置: ${config.name}\n`);

    const editChoice = await this.inquirer.prompt([
      {
        type: 'list',
        name: 'section',
        message: '选择要编辑的部分:',
        choices: [
          { name: '基本信息', value: 'basic' },
          { name: 'OpenAPI 配置', value: 'openapi' },
          { name: '传输配置', value: 'transport' },
          { name: '高级配置', value: 'advanced' },
          { name: '取消', value: 'cancel' }
        ]
      }
    ]);

    if (editChoice.section === 'cancel') {
      return null;
    }

    let updatedConfig = { ...config };

    switch (editChoice.section) {
      case 'basic':
        const basicInfo = await this.getBasicInfo(config);
        if (basicInfo) {
          updatedConfig = { ...updatedConfig, ...basicInfo };
        }
        break;

      case 'openapi':
        const openApiConfig = await this.getOpenAPIConfig(config.openApiUrl);
        if (openApiConfig) {
          updatedConfig = { ...updatedConfig, ...openApiConfig };
        }
        break;

      case 'transport':
        const transportConfig = await this.getTransportConfig(config);
        if (transportConfig) {
          updatedConfig = { ...updatedConfig, ...transportConfig };
        }
        break;

      case 'advanced':
        const advancedConfig = await this.getAdvancedConfig(config);
        if (advancedConfig) {
          updatedConfig = { ...updatedConfig, ...advancedConfig };
        }
        break;
    }

    return updatedConfig;
  }

  /**
   * 获取基本信息
   */
  private async getBasicInfo(existing?: SessionConfig): Promise<Partial<SessionConfig> | null> {
    const answers = await this.inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: '配置名称:',
        default: existing?.name,
        validate: (input: string) => {
          if (!input.trim()) {
            return '配置名称不能为空';
          }
          if (input.length > 50) {
            return '配置名称不能超过 50 个字符';
          }
          return true;
        }
      },
      {
        type: 'input',
        name: 'description',
        message: '配置描述 (可选):',
        default: existing?.description
      }
    ]);

    return answers;
  }

  /**
   * 选择 OpenAPI URL 来源
   */
  private async getOpenAPIConfig(existingUrl?: string): Promise<Partial<SessionConfig> | null> {
    const sourceChoice = await this.inquirer.prompt([
      {
        type: 'list',
        name: 'source',
        message: '选择 OpenAPI 文档来源:',
        choices: [
          { name: '在线 URL', value: 'url' },
          { name: '本地文件', value: 'file' },
          { name: '预设 URL', value: 'preset' },
          { name: '手动输入', value: 'manual' }
        ]
      }
    ]);

    let openApiUrl: string;

    switch (sourceChoice.source) {
      case 'preset':
        const presetUrl = await this.selectPresetUrl();
        if (!presetUrl) return null;
        openApiUrl = presetUrl;
        break;

      case 'file':
        const filePath = await this.getLocalFilePath();
        if (!filePath) return null;
        openApiUrl = filePath;
        break;

      case 'manual':
        const manualUrl = await this.getManualUrl(existingUrl);
        if (!manualUrl) return null;
        openApiUrl = manualUrl;
        break;

      case 'url':
      default:
        const urlInput = await this.inquirer.prompt([
          {
            type: 'input',
            name: 'url',
            message: '输入 OpenAPI 文档 URL:',
            default: existingUrl,
            validate: (input: string) => {
              if (!input.trim()) {
                return 'URL 不能为空';
              }
              try {
                new URL(input);
                return true;
              } catch {
                return '请输入有效的 URL';
              }
            }
          }
        ]);
        openApiUrl = urlInput.url;
        break;
    }

    // 验证 OpenAPI 文档
    const validation = await this.validateOpenAPIDocument(openApiUrl);
    if (!validation.valid) {
      console.error('❌ OpenAPI 文档验证失败:');
      validation.errors?.forEach((error: any) => console.error(`  - ${error}`));
      return null;
    }

    console.log('✅ OpenAPI 文档验证成功!');
    if (validation.title) console.log(`  标题: ${validation.title}`);
    if (validation.version) console.log(`  版本: ${validation.version}`);
    if (validation.operationCount) console.log(`  操作数量: ${validation.operationCount}`);

    // 询问是否进行接口选择
    const wantInterfaceSelection = await this.inquirer.prompt([
      {
        type: 'confirm',
        name: 'enable',
        message: '是否要选择特定的接口转换为 MCP tools？',
        default: false
      }
    ]);

    let interfaceSelection: InterfaceSelectionConfig | undefined;
    if (wantInterfaceSelection.enable) {
      // 解析 OpenAPI 规范以获取接口列表
      const spec = await this.parseOpenAPISpec(openApiUrl);
      if (spec) {
        const selector = new InterfaceSelector(spec as any, {});
        const selectionResult = await selector.selectInterfaces();
        interfaceSelection = {
          mode: selectionResult.selectionMode as any,
          selectedEndpoints: selectionResult.selectedEndpoints,
          selectedTags: selectionResult.selectedTags,
          pathPatterns: selectionResult.pathPatterns
        };
      }
    }

    return { openApiUrl, interfaceSelection } as Partial<SessionConfig>;
  }

  /**
   * 从预设 URL 中选择
   */
  private async selectPresetUrl(): Promise<string | null> {
    const choices = this.presetUrls.map(preset => ({
      name: `${preset.name} - ${preset.description}`,
      value: preset.url
    }));

    choices.push({ name: '取消', value: '' });

    const answer = await this.inquirer.prompt([
      {
        type: 'list',
        name: 'url',
        message: '选择预设的 OpenAPI URL:',
        choices
      }
    ]);

    return answer.url;
  }

  /**
   * 获取本地文件路径
   */
  private async getLocalFilePath(): Promise<string | null> {
    const answer = await this.inquirer.prompt([
      {
        type: 'input',
        name: 'path',
        message: '输入本地 OpenAPI 文件路径:',
        validate: async (input: string) => {
          if (!input.trim()) {
            return '文件路径不能为空';
          }
          try {
            await fs.access(input);
            return true;
          } catch {
            return '文件不存在或无法访问';
          }
        }
      }
    ]);

    return answer.path;
  }

  /**
   * 手动输入 URL
   */
  private async getManualUrl(existing?: string): Promise<string | null> {
    const answer = await this.inquirer.prompt([
      {
        type: 'input',
        name: 'url',
        message: '输入 OpenAPI 文档 URL:',
        default: existing,
        validate: (input: string) => {
          if (!input.trim()) {
            return 'URL 不能为空';
          }
          return true;
        }
      }
    ]);

    return answer.url;
  }

  /**
   * 验证 OpenAPI 文档
   */
  private async validateOpenAPIDocument(url: string): Promise<OpenAPIValidationResult> {
    try {
      const content = await this.loadOpenApiSource(url);

      // 基本验证
      if (!content || typeof content !== 'object') {
        return {
          valid: false,
          errors: ['文档格式无效']
        };
      }

      // 检查 OpenAPI 版本
      const version = content.openapi || content.swagger;
      if (!version) {
        return {
          valid: false,
          errors: ['缺少 OpenAPI 或 Swagger 版本信息']
        };
      }

      // 统计操作数量
      let operationCount = 0;
      if (content.paths) {
        Object.values(content.paths).forEach((path: any) => {
          if (path && typeof path === 'object') {
            operationCount += Object.keys(path).filter(key => 
              ['get', 'post', 'put', 'delete', 'patch', 'head', 'options'].includes(key)
            ).length;
          }
        });
      }

      return {
        valid: true,
        title: content.info?.title,
        version: content.info?.version,
        description: content.info?.description,
        operationCount
      };
    } catch (error) {
      return {
        valid: false,
        errors: [`验证失败: ${error instanceof Error ? error.message : '未知错误'}`]
      };
    }
  }

  /**
   * 获取传输配置
   */
  private async getTransportConfig(existing?: SessionConfig): Promise<Partial<SessionConfig> | null> {
    const answers = await this.inquirer.prompt([
      {
        type: 'list',
        name: 'transport',
        message: '选择传输协议:',
        choices: [
          {
            name: 'STDIO - 标准输入输出',
            value: 'stdio',
            disabled: '交互式会话模式不支持，请使用 --openapi 直接启动'
          },
          { name: 'SSE - Server-Sent Events', value: 'sse' },
          { name: 'Streamable - 流式传输', value: 'streamable' }
        ],
        default: existing?.transport && existing.transport !== 'stdio' ? existing.transport : 'streamable'
      }
    ]);

    const transport: TransportType = answers.transport;
    let additionalConfig: Partial<SessionConfig> = { transport };

    // 如果选择了 SSE 或 Streamable，需要配置端口和主机
    if (transport === 'sse' || transport === 'streamable') {
      const networkConfig = await this.inquirer.prompt([
        {
          type: 'number',
          name: 'port',
          message: '端口号:',
          default: existing?.port || (transport === 'sse' ? 3000 : 8080),
          validate: (input: number) => {
            if (input < 1 || input > 65535) {
              return '端口号必须在 1-65535 之间';
            }
            return true;
          }
        },
        {
          type: 'input',
          name: 'host',
          message: '主机地址:',
          default: existing?.host || 'localhost'
        }
      ]);

      additionalConfig = { ...additionalConfig, ...networkConfig };
    }

    return additionalConfig;
  }

  /**
   * 获取高级配置
   */
  private async getAdvancedConfig(existing?: SessionConfig): Promise<Partial<SessionConfig> | null> {

    const choices = [
      { name: '操作过滤器', value: 'filter' },
      { name: '认证配置', value: 'auth' },
      { name: '自定义请求头', value: 'headers' },
      { name: '完成', value: 'done' }
    ];

    let config: Partial<SessionConfig> = {
      auth: existing?.auth,
      customHeaders: existing?.customHeaders,
      operationFilter: existing?.operationFilter
    };

    while (true) {
      const choice = await this.inquirer.prompt([
        {
          type: 'list',
          name: 'option',
          message: '选择要配置的高级选项:',
          choices
        }
      ]);

      switch (choice.option) {
        case 'filter':
          const filterConfig = await this.getOperationFilterConfig(config.operationFilter);
          if (filterConfig) {
            config.operationFilter = filterConfig;
          }
          break;

        case 'auth':
          const authConfig = await this.getAuthConfig(config.auth);
          if (authConfig) {
            config.auth = authConfig;
          }
          break;

        case 'headers':
          const headersConfig = await this.getCustomHeadersConfig(config.customHeaders);
          if (headersConfig) {
            config.customHeaders = headersConfig;
          }
          break;

        case 'done':
          return config;
      }
    }
  }

  /**
   * 获取操作过滤器配置
   */
  private async getOperationFilterConfig(existing?: OperationFilter): Promise<OperationFilter | null> {
    const answers = await this.inquirer.prompt([
      {
        type: 'checkbox',
        name: 'includeMethods',
        message: '选择要包含的 HTTP 方法:',
        choices: [
          { name: 'GET', value: 'GET' },
          { name: 'POST', value: 'POST' },
          { name: 'PUT', value: 'PUT' },
          { name: 'DELETE', value: 'DELETE' },
          { name: 'PATCH', value: 'PATCH' },
          { name: 'HEAD', value: 'HEAD' },
          { name: 'OPTIONS', value: 'OPTIONS' }
        ],
        default: existing?.methods?.include || ['GET', 'POST', 'PUT', 'DELETE']
      },
      {
        type: 'checkbox',
        name: 'excludeMethods',
        message: '选择要排除的 HTTP 方法:',
        choices: [
          { name: 'GET', value: 'GET' },
          { name: 'POST', value: 'POST' },
          { name: 'PUT', value: 'PUT' },
          { name: 'DELETE', value: 'DELETE' },
          { name: 'PATCH', value: 'PATCH' },
          { name: 'HEAD', value: 'HEAD' },
          { name: 'OPTIONS', value: 'OPTIONS' }
        ],
        default: existing?.methods?.exclude || []
      },
      {
        type: 'input',
        name: 'includePaths',
        message: '包含的路径模式 (用逗号分隔，支持通配符):',
        default: existing?.paths?.include?.join(', ') || ''
      },
      {
        type: 'input',
        name: 'excludePaths',
        message: '排除的路径模式 (用逗号分隔，支持通配符):',
        default: existing?.paths?.exclude?.join(', ') || ''
      }
    ]);

    const filter: OperationFilter = {};
    
    if (answers.includeMethods.length > 0 || answers.excludeMethods.length > 0) {
      filter.methods = {};
      if (answers.includeMethods.length > 0) {
        filter.methods.include = answers.includeMethods;
      }
      if (answers.excludeMethods.length > 0) {
        filter.methods.exclude = answers.excludeMethods;
      }
    }
    
    if (answers.includePaths || answers.excludePaths) {
      filter.paths = {};
      if (answers.includePaths) {
        filter.paths.include = answers.includePaths.split(',').map((p: string) => p.trim()).filter(Boolean);
      }
      if (answers.excludePaths) {
        filter.paths.exclude = answers.excludePaths.split(',').map((p: string) => p.trim()).filter(Boolean);
      }
    }

    return Object.keys(filter).length > 0 ? filter : null;
  }

  /**
   * 获取认证配置
   */
  private async getAuthConfig(existing?: AuthConfig): Promise<AuthConfig | null> {
    const typeAnswer = await this.inquirer.prompt([
      {
        type: 'list',
        name: 'type',
        message: '选择认证类型:',
        choices: [
          { name: 'Bearer Token', value: 'bearer' },
          { name: '无认证', value: 'none' }
        ],
        default: existing?.type || 'none'
      }
    ]);

    if (typeAnswer.type === 'none') {
      return null;
    }

    let authConfig: AuthConfig = { type: typeAnswer.type };

    switch (typeAnswer.type) {
      case 'bearer':
        const bearerAnswer = await this.inquirer.prompt([
          {
            type: 'password',
            name: 'token',
            message: '输入 Bearer Token:',
            default: existing?.token
          }
        ]);
        authConfig.token = bearerAnswer.token;
        break;

    }

    return authConfig;
  }

  /**
   * 获取自定义请求头配置
   */
  private async getCustomHeadersConfig(existing?: CustomHeaders): Promise<CustomHeaders | null> {
    const normalizedExisting: CustomHeaders | undefined =
      existing && !('static' in existing) && !('env' in existing) && !('dynamic' in existing) && !('conditional' in existing)
        ? { static: existing as Record<string, string> }
        : existing;

    let headers = { ...(normalizedExisting?.static || {}) };

    while (true) {
      const currentHeaders = Object.entries(headers);
      const choices = [
        { name: '添加新请求头', value: 'add' },
        ...currentHeaders.map(([key, value]) => ({
          name: `删除: ${key}: ${value}`,
          value: `delete:${key}`
        })),
        { name: '完成', value: 'done' }
      ];

      if (currentHeaders.length > 0) {
        console.log('\n当前自定义请求头:');
        currentHeaders.forEach(([key, value]) => {
          console.log(`  ${key}: ${value}`);
        });
      }

      const choice = await this.inquirer.prompt([
        {
          type: 'list',
          name: 'action',
          message: '选择操作:',
          choices
        }
      ]);

      if (choice.action === 'done') {
        break;
      } else if (choice.action === 'add') {
        const headerInfo = await this.inquirer.prompt([
          {
            type: 'input',
            name: 'key',
            message: '请求头名称:',
            validate: (input: string) => {
              if (!input.trim()) {
                return '请求头名称不能为空';
              }
              if (headers[input]) {
                return '该请求头已存在';
              }
              return true;
            }
          },
          {
            type: 'input',
            name: 'value',
            message: '请求头值:',
            validate: (input: string) => {
              if (!input.trim()) {
                return '请求头值不能为空';
              }
              return true;
            }
          }
        ]);
        headers[headerInfo.key] = headerInfo.value;
      } else if (choice.action.startsWith('delete:')) {
        const keyToDelete = choice.action.replace('delete:', '');
        delete headers[keyToDelete];
      }
    }

    const hasStatic = Object.keys(headers).length > 0;
    const hasOther =
      !!normalizedExisting?.env ||
      !!normalizedExisting?.dynamic ||
      !!normalizedExisting?.conditional;

    if (!hasStatic && !hasOther) {
      return null;
    }

    return {
      ...normalizedExisting,
      static: headers
    };
  }

  /**
   * 解析 OpenAPI 规范
   */
  private async parseOpenAPISpec(url: string): Promise<OpenAPIV3.Document | null> {
    try {
      const content = await this.loadOpenApiSource(url);
      return content as OpenAPIV3.Document;
    } catch (error) {
      console.error('解析 OpenAPI 规范失败:', error);
      return null;
    }
  }

  /**
   * 加载 OpenAPI 数据（支持 JSON/YAML）
   */
  private async loadOpenApiSource(source: string): Promise<any> {
    if (source.startsWith('http://') || source.startsWith('https://')) {
      const response = await axios.get(source, { timeout: 10000 });
      const data = response.data;
      if (typeof data === 'string') {
        return this.parseOpenApiContent(data, source);
      }
      return data;
    }

    const fileContent = await fs.readFile(source, 'utf-8');
    return this.parseOpenApiContent(fileContent, source);
  }

  private parseOpenApiContent(raw: string, source: string): any {
    const trimmed = raw.trim();
    if (!trimmed) {
      throw new Error(`OpenAPI 内容为空: ${source}`);
    }

    try {
      return JSON.parse(trimmed);
    } catch {
      return yaml.load(trimmed);
    }
  }

  // extractEndpoints 已由 InterfaceSelector 内部处理
}
