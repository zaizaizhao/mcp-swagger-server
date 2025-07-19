import type { 
  OpenAPISpec, 
  MCPServer, 
  ServerConfig, 
  AuthConfig, 
  TestCase,
  ValidationError as UIValidationError,
  ConfigFile,
  ImportResult,
  ConfigConflict
} from '@/types'
import { 
  Validator, 
  parseFromString, 
  parseFromUrl,
  type ValidationResult as ParserValidationResult,
  type ParserConfig,
  DEFAULT_PARSER_CONFIG
} from 'mcp-swagger-parser'

// ============================================================================
// OpenAPI 规范验证
// ============================================================================

/**
 * 验证 OpenAPI 规范内容
 */
export const validateOpenAPISpec = async (
  content: string | object,
  config?: ParserConfig
): Promise<{ isValid: boolean; errors: UIValidationError[]; warnings: UIValidationError[] }> => {
  try {
    const parserConfig = { ...DEFAULT_PARSER_CONFIG, ...config }
    const validator = new Validator(parserConfig)
    
    let spec: any
    if (typeof content === 'string') {
      const parseResult = await parseFromString(content, parserConfig)
      spec = parseResult.spec
    } else {
      spec = content
    }
    
    const result: ParserValidationResult = await validator.validate(spec)
    
    return {
      isValid: result.isValid,
      errors: result.errors.map(err => ({
        path: err.path,
        message: err.message,
        severity: 'error' as const,
        code: err.code
      })),
      warnings: result.warnings.map(warn => ({
        path: warn.path,
        message: warn.message,
        severity: 'warning' as const,
        code: warn.code
      }))
    }
  } catch (error) {
    return {
      isValid: false,
      errors: [{
        path: 'root',
        message: error instanceof Error ? error.message : '验证过程中发生未知错误',
        severity: 'error' as const,
        code: 'VALIDATION_EXCEPTION'
      }],
      warnings: []
    }
  }
}

/**
 * 验证 OpenAPI 规范 URL
 */
export const validateOpenAPIUrl = async (
  url: string,
  config?: ParserConfig
): Promise<{ isValid: boolean; errors: UIValidationError[]; warnings: UIValidationError[] }> => {
  try {
    const parserConfig = { ...DEFAULT_PARSER_CONFIG, ...config }
    const parseResult = await parseFromUrl(url, parserConfig)
    
    const validator = new Validator(parserConfig)
    const result: ParserValidationResult = await validator.validate(parseResult.spec)
    
    return {
      isValid: result.isValid,
      errors: result.errors.map(err => ({
        path: err.path,
        message: err.message,
        severity: 'error' as const,
        code: err.code
      })),
      warnings: result.warnings.map(warn => ({
        path: warn.path,
        message: warn.message,
        severity: 'warning' as const,
        code: warn.code
      }))
    }
  } catch (error) {
    return {
      isValid: false,
      errors: [{
        path: 'root',
        message: error instanceof Error ? error.message : 'URL 验证过程中发生未知错误',
        severity: 'error' as const,
        code: 'URL_VALIDATION_EXCEPTION'
      }],
      warnings: []
    }
  }
}

// ============================================================================
// 服务器配置验证
// ============================================================================

/**
 * 验证服务器配置
 */
export const validateServerConfig = (config: Partial<ServerConfig>): UIValidationError[] => {
  const errors: UIValidationError[] = []
  
  // 验证服务器名称
  if (!config.name) {
    errors.push({
      path: 'name',
      message: '服务器名称不能为空',
      severity: 'error',
      code: 'REQUIRED_FIELD'
    })
  } else if (config.name.length < 2 || config.name.length > 50) {
    errors.push({
      path: 'name',
      message: '服务器名称长度必须在 2-50 个字符之间',
      severity: 'error',
      code: 'INVALID_LENGTH'
    })
  } else if (!/^[a-zA-Z0-9\u4e00-\u9fa5_-]+$/.test(config.name)) {
    errors.push({
      path: 'name',
      message: '服务器名称只能包含字母、数字、中文、下划线和连字符',
      severity: 'error',
      code: 'INVALID_FORMAT'
    })
  }
  
  // 验证端点 URL
  if (!config.endpoint) {
    errors.push({
      path: 'endpoint',
      message: '服务器端点不能为空',
      severity: 'error',
      code: 'REQUIRED_FIELD'
    })
  } else {
    try {
      const url = new URL(config.endpoint)
      if (!['http:', 'https:'].includes(url.protocol)) {
        errors.push({
          path: 'endpoint',
          message: '端点必须使用 HTTP 或 HTTPS 协议',
          severity: 'error',
          code: 'INVALID_PROTOCOL'
        })
      }
    } catch {
      errors.push({
        path: 'endpoint',
        message: '端点 URL 格式无效',
        severity: 'error',
        code: 'INVALID_URL'
      })
    }
  }
  
  // 验证 OpenAPI 规范
  if (!config.openApiSpec) {
    errors.push({
      path: 'openApiSpec',
      message: 'OpenAPI 规范不能为空',
      severity: 'error',
      code: 'REQUIRED_FIELD'
    })
  }
  
  // 验证认证配置
  if (config.authentication) {
    const authErrors = validateAuthConfig(config.authentication)
    errors.push(...authErrors.map(err => ({
      ...err,
      path: `authentication.${err.path}`
    })))
  }
  
  return errors
}

/**
 * 验证认证配置
 */
export const validateAuthConfig = (config: Partial<AuthConfig>): UIValidationError[] => {
  const errors: UIValidationError[] = []
  
  if (!config.type) {
    errors.push({
      path: 'type',
      message: '认证类型不能为空',
      severity: 'error',
      code: 'REQUIRED_FIELD'
    })
    return errors
  }
  
  const { type, credentials } = config
  
  if (!credentials) {
    errors.push({
      path: 'credentials',
      message: '认证凭据不能为空',
      severity: 'error',
      code: 'REQUIRED_FIELD'
    })
    return errors
  }
  
  switch (type) {
    case 'bearer':
      if (!credentials.token) {
        errors.push({
          path: 'credentials.token',
          message: 'Bearer Token 不能为空',
          severity: 'error',
          code: 'REQUIRED_FIELD'
        })
      }
      break
      
    case 'apikey':
      if (!credentials.apiKey) {
        errors.push({
          path: 'credentials.apiKey',
          message: 'API Key 不能为空',
          severity: 'error',
          code: 'REQUIRED_FIELD'
        })
      }
      break
      
    case 'basic':
      if (!credentials.username) {
        errors.push({
          path: 'credentials.username',
          message: '用户名不能为空',
          severity: 'error',
          code: 'REQUIRED_FIELD'
        })
      }
      if (!credentials.password) {
        errors.push({
          path: 'credentials.password',
          message: '密码不能为空',
          severity: 'error',
          code: 'REQUIRED_FIELD'
        })
      }
      break
      
    case 'oauth2':
      if (!credentials.clientId) {
        errors.push({
          path: 'credentials.clientId',
          message: 'Client ID 不能为空',
          severity: 'error',
          code: 'REQUIRED_FIELD'
        })
      }
      if (!credentials.clientSecret) {
        errors.push({
          path: 'credentials.clientSecret',
          message: 'Client Secret 不能为空',
          severity: 'error',
          code: 'REQUIRED_FIELD'
        })
      }
      break
  }
  
  return errors
}

// ============================================================================
// 测试用例验证
// ============================================================================

/**
 * 验证测试用例
 */
export const validateTestCase = (testCase: Partial<TestCase>): UIValidationError[] => {
  const errors: UIValidationError[] = []
  
  if (!testCase.name) {
    errors.push({
      path: 'name',
      message: '测试用例名称不能为空',
      severity: 'error',
      code: 'REQUIRED_FIELD'
    })
  } else if (testCase.name.length < 2 || testCase.name.length > 100) {
    errors.push({
      path: 'name',
      message: '测试用例名称长度必须在 2-100 个字符之间',
      severity: 'error',
      code: 'INVALID_LENGTH'
    })
  }
  
  if (!testCase.toolId) {
    errors.push({
      path: 'toolId',
      message: '工具 ID 不能为空',
      severity: 'error',
      code: 'REQUIRED_FIELD'
    })
  }
  
  if (!testCase.parameters || typeof testCase.parameters !== 'object') {
    errors.push({
      path: 'parameters',
      message: '参数必须是有效的对象',
      severity: 'error',
      code: 'INVALID_TYPE'
    })
  }
  
  return errors
}

// ============================================================================
// 配置文件验证
// ============================================================================

/**
 * 验证配置文件格式
 */
export const validateConfigFile = (config: any): { isValid: boolean; errors: UIValidationError[] } => {
  const errors: UIValidationError[] = []
  
  if (!config || typeof config !== 'object') {
    errors.push({
      path: 'root',
      message: '配置文件必须是有效的 JSON 对象',
      severity: 'error',
      code: 'INVALID_FORMAT'
    })
    return { isValid: false, errors }
  }
  
  if (!config.version) {
    errors.push({
      path: 'version',
      message: '配置文件缺少版本信息',
      severity: 'error',
      code: 'MISSING_VERSION'
    })
  }
  
  if (!config.exportedAt) {
    errors.push({
      path: 'exportedAt',
      message: '配置文件缺少导出时间',
      severity: 'error',
      code: 'MISSING_TIMESTAMP'
    })
  }
  
  if (config.servers && Array.isArray(config.servers)) {
    config.servers.forEach((server: any, index: number) => {
      const serverErrors = validateServerConfig(server)
      errors.push(...serverErrors.map(err => ({
        ...err,
        path: `servers[${index}].${err.path}`
      })))
    })
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * 检测配置冲突
 */
export const detectConfigConflicts = (
  existingServers: MCPServer[],
  importedServers: MCPServer[]
): ConfigConflict[] => {
  const conflicts: ConfigConflict[] = []
  
  importedServers.forEach(importedServer => {
    const existingServer = existingServers.find(s => s.id === importedServer.id)
    
    if (existingServer) {
      // 检查名称冲突
      if (existingServer.name !== importedServer.name) {
        conflicts.push({
          type: 'server',
          field: `servers.${importedServer.id}.name`,
          existingValue: existingServer.name,
          newValue: importedServer.name
        })
      }
      
      // 检查端点冲突
      if (existingServer.endpoint !== importedServer.endpoint) {
        conflicts.push({
          type: 'server',
          field: `servers.${importedServer.id}.endpoint`,
          existingValue: existingServer.endpoint,
          newValue: importedServer.endpoint
        })
      }
      
      // 检查配置冲突
      if (JSON.stringify(existingServer.config) !== JSON.stringify(importedServer.config)) {
        conflicts.push({
          type: 'server',
          field: `servers.${importedServer.id}.config`,
          existingValue: existingServer.config,
          newValue: importedServer.config
        })
      }
    }
  })
  
  return conflicts
}