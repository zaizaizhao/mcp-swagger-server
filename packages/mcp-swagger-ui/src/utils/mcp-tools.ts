import type { MCPTool, ParameterSchema } from '../types'

/**
 * 构建API调用的参数对象
 */
export const buildAPICallParameters = (tool: MCPTool, formData: Record<string, any>) => {
  const result: Record<string, any> = {}
  
  if (tool.parameters?.properties) {
    Object.entries(tool.parameters.properties).forEach(([key, schema]) => {
      if (formData[key] !== undefined && formData[key] !== '') {
        result[key] = convertParameterValue(formData[key], schema)
      }
    })
  }
  
  return result
}

/**
 * 根据schema类型转换参数值
 */
export const convertParameterValue = (value: any, schema: any): any => {
  if (value === null || value === undefined || value === '') {
    return schema.default || null
  }
  
  switch (schema.type) {
    case 'integer':
      return parseInt(value, 10)
    case 'number':
      return parseFloat(value)
    case 'boolean':
      return value === true || value === 'true' || value === '1'
    case 'array':
      if (typeof value === 'string') {
        try {
          return JSON.parse(value)
        } catch {
          return value.split(',').map(item => item.trim())
        }
      }
      return Array.isArray(value) ? value : [value]
    case 'object':
      if (typeof value === 'string') {
        try {
          return JSON.parse(value)
        } catch {
          return value
        }
      }
      return value
    default:
      return String(value)
  }
}

/**
 * 构建URL路径，替换路径参数
 */
export const buildURLPath = (path: string, parameters: Record<string, any>): string => {
  let result = path
  
  // 替换路径参数 {param} 为实际值
  const pathParamRegex = /{([^}]+)}/g
  result = result.replace(pathParamRegex, (match, paramName) => {
    return parameters[paramName] || match
  })
  
  return result
}

/**
 * 构建查询字符串
 */
export const buildQueryString = (parameters: Record<string, any>, excludePathParams: string[] = []): string => {
  const queryParams: string[] = []
  
  Object.entries(parameters).forEach(([key, value]) => {
    if (!excludePathParams.includes(key) && value !== null && value !== undefined && value !== '') {
      if (Array.isArray(value)) {
        value.forEach(item => {
          queryParams.push(`${encodeURIComponent(key)}=${encodeURIComponent(item)}`)
        })
      } else {
        queryParams.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      }
    }
  })
  
  return queryParams.length > 0 ? `?${queryParams.join('&')}` : ''
}

/**
 * 从路径中提取路径参数名称
 */
export const extractPathParameters = (path: string): string[] => {
  const pathParamRegex = /{([^}]+)}/g
  const matches = []
  let match
  
  while ((match = pathParamRegex.exec(path)) !== null) {
    matches.push(match[1])
  }
  
  return matches
}

/**
 * 验证必需参数
 */
export const validateRequiredParameters = (
  tool: MCPTool, 
  parameters: Record<string, any>
): { isValid: boolean; missingParams: string[] } => {
  const missingParams: string[] = []
  
  if (tool.parameters?.required) {
    tool.parameters.required.forEach(paramName => {
      if (parameters[paramName] === undefined || parameters[paramName] === null || parameters[paramName] === '') {
        missingParams.push(paramName)
      }
    })
  }
  
  return {
    isValid: missingParams.length === 0,
    missingParams
  }
}

/**
 * 格式化API响应
 */
export const formatAPIResponse = (response: any): string => {
  try {
    if (typeof response === 'string') {
      // 尝试解析JSON字符串
      try {
        const parsed = JSON.parse(response)
        return JSON.stringify(parsed, null, 2)
      } catch {
        return response
      }
    }
    
    return JSON.stringify(response, null, 2)
  } catch (error) {
    return String(response)
  }
}

/**
 * 生成MCP工具调用请求
 */
export const generateMCPToolCall = (tool: MCPTool, parameters: Record<string, any>) => {
  return {
    method: 'tools/call',
    params: {
      name: tool.name,
      arguments: parameters
    }
  }
}

/**
 * 模拟MCP工具执行
 */
export const simulateMCPToolExecution = async (
  tool: MCPTool, 
  parameters: Record<string, any>
): Promise<{ success: boolean; result?: any; error?: string }> => {
  try {
    // 验证必需参数
    const validation = validateRequiredParameters(tool, parameters)
    if (!validation.isValid) {
      return {
        success: false,
        error: `Missing required parameters: ${validation.missingParams.join(', ')}`
      }
    }

    // 构建API调用参数
    const apiParams = buildAPICallParameters(tool, parameters)
    
    // 构建完整URL
    const pathParams = extractPathParameters(tool.path || tool.endpoint || '')
    const urlPath = buildURLPath(tool.path || tool.endpoint || '', apiParams)
    const queryString = buildQueryString(apiParams, pathParams)
    const fullUrl = `${urlPath}${queryString}`

    // 模拟API调用结果
    const mockResult = {
      tool: tool.name,
      method: tool.method,
      url: fullUrl,
      parameters: apiParams,
      timestamp: new Date().toISOString(),
      simulation: true,
      message: 'This is a simulated response. In a real implementation, this would make an actual API call.'
    }

    return {
      success: true,
      result: mockResult
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }
  }
}

/**
 * 生成工具配置JSON
 */
export const generateToolConfig = (tool: MCPTool): string => {
  const config = {
    name: tool.name,
    description: tool.description,
    inputSchema: tool.parameters || {
      type: 'object',
      properties: {},
      required: []
    }
  }
  
  return JSON.stringify(config, null, 2)
}

/**
 * 生成工具JSON Schema
 */
export const generateToolSchema = (tool: MCPTool): string => {
  return JSON.stringify(tool.parameters || {}, null, 2)
}
