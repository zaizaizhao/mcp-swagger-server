import type {
  OpenAPISpec,
  MCPServer,
  MCPTool,
  ServerConfig,
  TestCase,
  ConfigFile,
  ImportResult,
  ApiEndpoint,
  ParameterSchema,
  PropertySchema
} from '@/types'
import {
  transformToMCPTools,
  parseFromString,
  parseFromUrl,
  parseFromFile,
  type TransformerOptions,
  type MCPTool as ParserMCPTool,
  DEFAULT_TRANSFORMER_OPTIONS
} from 'mcp-swagger-parser'
import { generateId } from './index'

// ============================================================================
// OpenAPI 到 MCP 工具转换
// ============================================================================

/**
 * 将 OpenAPI 规范转换为 MCP 工具
 */
export const convertOpenAPIToMCPTools = async (
  spec: OpenAPISpec | string | object,
  serverId: string,
  options?: TransformerOptions
): Promise<MCPTool[]> => {
  try {
    const transformerOptions = { ...DEFAULT_TRANSFORMER_OPTIONS, ...options }
    
    let openApiSpec: any
    if (typeof spec === 'string') {
      const parseResult = await parseFromString(spec)
      openApiSpec = parseResult.spec
    } else if ('content' in spec) {
      openApiSpec = spec.content
    } else {
      openApiSpec = spec
    }
    
    const parserTools: ParserMCPTool[] = await transformToMCPTools(openApiSpec, transformerOptions)
    
    // 转换为 UI 层的 MCP 工具格式
    return parserTools.map(tool => convertParserToolToUITool(tool, serverId))
  } catch (error) {
    console.error('OpenAPI 转换失败:', error)
    throw new Error(`OpenAPI 转换失败: ${error instanceof Error ? error.message : '未知错误'}`)
  }
}

/**
 * 将解析器工具转换为 UI 工具格式
 */
const convertParserToolToUITool = (parserTool: ParserMCPTool, serverId: string): MCPTool => {
  return {
    id: generateId('tool'),
    name: parserTool.name,
    description: parserTool.description || '',
    parameters: convertToParameterSchema(parserTool.inputSchema),
    serverId,
    endpoint: {
      method: parserTool.metadata?.method?.toUpperCase() || 'GET',
      path: parserTool.metadata?.path || '',
      summary: parserTool.description,
      description: parserTool.description,
      operationId: parserTool.metadata?.operationId || parserTool.name,
      tags: parserTool.metadata?.tags,
      deprecated: parserTool.metadata?.deprecated
    },
    createdAt: new Date()
  }
}

/**
 * 转换输入模式为参数模式
 */
const convertToParameterSchema = (inputSchema: any): ParameterSchema => {
  if (!inputSchema || typeof inputSchema !== 'object') {
    return {
      type: 'object',
      properties: {},
      required: []
    }
  }
  
  return {
    type: 'object',
    properties: convertProperties(inputSchema.properties || {}),
    required: inputSchema.required || []
  }
}

/**
 * 转换属性定义
 */
const convertProperties = (properties: any): Record<string, PropertySchema> => {
  const converted: Record<string, PropertySchema> = {}
  
  for (const [key, value] of Object.entries(properties)) {
    if (typeof value === 'object' && value !== null) {
      const prop = value as any
      converted[key] = {
        type: prop.type || 'string',
        description: prop.description,
        enum: prop.enum,
        default: prop.default,
        format: prop.format,
        items: prop.items ? convertToPropertySchema(prop.items) : undefined,
        properties: prop.properties ? convertProperties(prop.properties) : undefined
      }
    }
  }
  
  return converted
}

/**
 * 转换为属性模式
 */
const convertToPropertySchema = (schema: any): PropertySchema => {
  return {
    type: schema.type || 'string',
    description: schema.description,
    enum: schema.enum,
    default: schema.default,
    format: schema.format,
    items: schema.items ? convertToPropertySchema(schema.items) : undefined,
    properties: schema.properties ? convertProperties(schema.properties) : undefined
  }
}

// ============================================================================
// 服务器数据转换
// ============================================================================

/**
 * 创建新的 MCP 服务器实例
 */
export const createMCPServer = (config: ServerConfig): MCPServer => {
  return {
    id: generateId('server'),
    name: config.name,
    endpoint: config.endpoint,
    status: 'stopped',
    config,
    tools: [],
    metrics: {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      uptime: 0
    },
    createdAt: new Date(),
    updatedAt: new Date()
  }
}

/**
 * 更新服务器配置
 */
export const updateServerConfig = (server: MCPServer, newConfig: Partial<ServerConfig>): MCPServer => {
  return {
    ...server,
    ...newConfig,
    config: { ...server.config, ...newConfig },
    updatedAt: new Date()
  }
}

/**
 * 克隆服务器配置
 */
export const cloneServerConfig = (server: MCPServer, newName: string): MCPServer => {
  return {
    ...server,
    id: generateId('server'),
    name: newName,
    status: 'stopped',
    tools: [],
    metrics: {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      uptime: 0
    },
    createdAt: new Date(),
    updatedAt: new Date()
  }
}

// ============================================================================
// 测试用例数据转换
// ============================================================================

/**
 * 创建新的测试用例
 */
export const createTestCase = (
  name: string,
  toolId: string,
  parameters: Record<string, any>,
  tags: string[] = []
): TestCase => {
  return {
    id: generateId('test'),
    name,
    toolId,
    parameters,
    tags,
    createdAt: new Date(),
    updatedAt: new Date()
  }
}

/**
 * 更新测试用例
 */
export const updateTestCase = (testCase: TestCase, updates: Partial<TestCase>): TestCase => {
  return {
    ...testCase,
    ...updates,
    updatedAt: new Date()
  }
}

/**
 * 从工具参数生成测试用例模板
 */
export const generateTestCaseTemplate = (tool: MCPTool): Partial<TestCase> => {
  const parameters: Record<string, any> = {}
  
  // 为每个参数生成默认值
  if (tool.parameters.properties) {
    for (const [key, prop] of Object.entries(tool.parameters.properties)) {
      parameters[key] = generateDefaultValue(prop)
    }
  }
  
  return {
    name: `${tool.name} 测试用例`,
    toolId: tool.id,
    parameters,
    tags: ['auto-generated']
  }
}

/**
 * 根据属性类型生成默认值
 */
const generateDefaultValue = (prop: PropertySchema): any => {
  if (prop.default !== undefined) {
    return prop.default
  }
  
  if (prop.enum && prop.enum.length > 0) {
    return prop.enum[0]
  }
  
  switch (prop.type) {
    case 'string':
      return prop.format === 'email' ? 'example@example.com' :
             prop.format === 'uri' ? 'https://example.com' :
             prop.format === 'date' ? '2024-01-01' :
             prop.format === 'date-time' ? '2024-01-01T00:00:00Z' :
             'example'
    case 'number':
      return 0
    case 'boolean':
      return false
    case 'array':
      return []
    case 'object':
      const obj: Record<string, any> = {}
      if (prop.properties) {
        for (const [key, subProp] of Object.entries(prop.properties)) {
          obj[key] = generateDefaultValue(subProp)
        }
      }
      return obj
    default:
      return null
  }
}

// ============================================================================
// 配置导入导出转换
// ============================================================================

/**
 * 将服务器列表转换为配置文件
 */
export const serversToConfigFile = (
  servers: MCPServer[],
  options: {
    includeSensitiveData?: boolean
    encryptSensitiveData?: boolean
  } = {}
): ConfigFile => {
  const { includeSensitiveData = false, encryptSensitiveData = false } = options
  
  const processedServers = servers.map(server => {
    const processedServer = { ...server }
    
    // 处理敏感数据
    if (!includeSensitiveData && processedServer.config.authentication) {
      processedServer.config = {
        ...processedServer.config,
        authentication: {
          ...processedServer.config.authentication,
          credentials: {} // 清空凭据
        }
      }
    }
    
    return processedServer
  })
  
  return {
    version: '1.0.0',
    exportedAt: new Date(),
    servers: processedServers,
    encrypted: encryptSensitiveData
  }
}

/**
 * 从配置文件解析服务器列表
 */
export const configFileToServers = (configFile: ConfigFile): ImportResult => {
  try {
    const servers = configFile.servers || []
    const importedServers = servers.length
    
    // 验证每个服务器配置
    const errors: string[] = []
    const validServers: MCPServer[] = []
    
    servers.forEach((server, index) => {
      try {
        // 确保必要的字段存在
        if (!server.id) server.id = generateId('server')
        if (!server.createdAt) server.createdAt = new Date()
        if (!server.updatedAt) server.updatedAt = new Date()
        if (!server.status) server.status = 'stopped'
        if (!server.tools) server.tools = []
        if (!server.metrics) {
          server.metrics = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            averageResponseTime: 0,
            uptime: 0
          }
        }
        
        validServers.push(server)
      } catch (error) {
        errors.push(`服务器 ${index + 1}: ${error instanceof Error ? error.message : '未知错误'}`)
      }
    })
    
    return {
      success: errors.length === 0,
      importedServers,
      errors: errors.length > 0 ? errors : undefined
    }
  } catch (error) {
    return {
      success: false,
      importedServers: 0,
      errors: [`配置文件解析失败: ${error instanceof Error ? error.message : '未知错误'}`]
    }
  }
}

// ============================================================================
// 数据格式转换工具
// ============================================================================

/**
 * 将对象转换为 JSON 字符串（格式化）
 */
export const toFormattedJSON = (obj: any, indent = 2): string => {
  return JSON.stringify(obj, null, indent)
}

/**
 * 将对象转换为 YAML 字符串
 */
export const toYAML = (obj: any): string => {
  // 简单的 YAML 转换实现
  const yamlify = (value: any, indent = 0): string => {
    const spaces = '  '.repeat(indent)
    
    if (value === null || value === undefined) {
      return 'null'
    }
    
    if (typeof value === 'string') {
      return value.includes('\n') || value.includes('"') || value.includes("'") 
        ? `"${value.replace(/"/g, '\\"')}"` 
        : value
    }
    
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value)
    }
    
    if (Array.isArray(value)) {
      if (value.length === 0) return '[]'
      return '\n' + value.map(item => `${spaces}- ${yamlify(item, indent + 1)}`).join('\n')
    }
    
    if (typeof value === 'object') {
      const entries = Object.entries(value)
      if (entries.length === 0) return '{}'
      
      return '\n' + entries.map(([key, val]) => {
        const yamlValue = yamlify(val, indent + 1)
        return yamlValue.startsWith('\n') 
          ? `${spaces}${key}:${yamlValue}`
          : `${spaces}${key}: ${yamlValue}`
      }).join('\n')
    }
    
    return String(value)
  }
  
  return yamlify(obj).trim()
}

/**
 * 从 JSON 或 YAML 字符串解析对象
 */
export const parseConfigString = (content: string): any => {
  const trimmed = content.trim()
  
  // 尝试解析 JSON
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return JSON.parse(trimmed)
    } catch (error) {
      throw new Error(`JSON 解析失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }
  
  // 简单的 YAML 解析（仅支持基本格式）
  try {
    const lines = trimmed.split('\n')
    const result: any = {}
    let currentPath: string[] = []
    
    for (const line of lines) {
      const trimmedLine = line.trim()
      if (!trimmedLine || trimmedLine.startsWith('#')) continue
      
      const indent = line.length - line.trimStart().length
      const colonIndex = trimmedLine.indexOf(':')
      
      if (colonIndex > 0) {
        const key = trimmedLine.substring(0, colonIndex).trim()
        const value = trimmedLine.substring(colonIndex + 1).trim()
        
        // 简化处理，仅支持一级对象
        if (value) {
          result[key] = value === 'true' ? true : 
                      value === 'false' ? false :
                      !isNaN(Number(value)) ? Number(value) : value
        }
      }
    }
    
    return result
  } catch (error) {
    throw new Error(`YAML 解析失败: ${error instanceof Error ? error.message : '未知错误'}`)
  }
}