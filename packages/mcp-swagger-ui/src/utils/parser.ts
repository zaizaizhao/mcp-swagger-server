/**
 * OpenAPI 解析器工具 - 简化版本带模拟模式
 */

import { shouldUseMockMode, mockApiInfo, mockEndpoints, mockConvertResult, mockDelay } from './mock'
import type {
    InputSource,
    ConvertConfig,
    OpenApiInfo,
    ApiEndpoint,
    ConvertResult
} from '@/types'

/**
 * 解析器错误类
 */
export class ParserError extends Error {
    constructor(message: string, public readonly code: string) {
        super(message)
        this.name = 'ParserError'
    }
}

/**
 * 验证结果接口
 */
interface ValidationResult {
    valid: boolean
    errors: Array<{
        code: string
        message: string
        path: string
        severity: 'error'
    }>
    warnings: Array<{
        code: string
        message: string
        path: string
        severity: 'warning'
    }>
}

/**
 * 检查是否可以使用真实解析器 - 导出供测试使用
 */
export async function canUseRealParser(): Promise<boolean> {
    // 首先检查环境变量是否强制禁用真实解析器
    if (import.meta.env.VITE_FORCE_MOCK_MODE === 'true') {
        console.log('🔒 环境变量强制使用模拟模式 (VITE_FORCE_MOCK_MODE=true)')
        return false
    }

    try {
        if (import.meta.env.VITE_FORCE_MOCK_MODE === 'false' || await import('@mcp-swagger/parser')) {
            console.log('✅ 真实解析器可用，将使用 @mcp-swagger/parser')
            return true
        }
        return false
    } catch (error) {
        console.warn('⚠️ 真实解析器不可用，将使用模拟模式:', error)
        return false
    }
}

/**
 * 验证 OpenAPI 规范
 */
export async function validateOpenAPISpec(source: InputSource): Promise<ValidationResult> {
    if (!(await canUseRealParser())) {
        console.log('🔄 使用模拟验证模式')
        await mockDelay(800)
        return {
            valid: true,
            errors: [],
            warnings: []
        }
    }

    console.log('🔄 使用真实解析器验证:', source.type, source.content)

    try {
        const { parseFromUrl, parseFromFile, parseFromString } = await import('@mcp-swagger/parser')

        let parseResult: any

        switch (source.type) {
            case 'url':
                parseResult = await parseFromUrl(source.content, {
                    strictMode: false,
                    resolveReferences: true,
                    validateSchema: true
                })
                break

            case 'file':
                parseResult = await parseFromFile(source.content, {
                    strictMode: false,
                    resolveReferences: true,
                    validateSchema: true
                })
                break

            case 'text':
                parseResult = await parseFromString(source.content, {
                    strictMode: false,
                    resolveReferences: true,
                    validateSchema: true
                })
                break

            default:
                throw new ParserError(`不支持的输入源类型: ${source.type}`, 'UNSUPPORTED_SOURCE_TYPE')
        }

        return {
            valid: parseResult.validation.valid,
            errors: parseResult.validation.errors || [],
            warnings: parseResult.validation.warnings || []
        }
    } catch (error) {
        return {
            valid: false,
            errors: [{
                code: 'PARSE_ERROR',
                message: error instanceof Error ? error.message : '解析失败',
                path: '',
                severity: 'error' as const
            }],
            warnings: []
        }
    }
}

/**
 * 预览 API 信息和端点
 */
export async function previewOpenAPISpec(source: InputSource): Promise<{
    apiInfo: OpenApiInfo
    endpoints: ApiEndpoint[]
}> {
    if (!(await canUseRealParser())) {
        console.log('🔄 使用模拟预览模式')
        await mockDelay(1200)
        return {
            apiInfo: mockApiInfo,
            endpoints: mockEndpoints
        }
    }

    console.log('🔄 使用真实解析器预览:', source.type, source.content)

    try {
        const { parseFromUrl, parseFromFile, parseFromString } = await import('@mcp-swagger/parser')

        let parseResult: any

        switch (source.type) {
            case 'url':
                parseResult = await parseFromUrl(source.content, {
                    strictMode: false,
                    resolveReferences: true,
                    validateSchema: true
                })
                break

            case 'file':
                parseResult = await parseFromFile(source.content, {
                    strictMode: false,
                    resolveReferences: true,
                    validateSchema: true
                })
                break

            case 'text':
                parseResult = await parseFromString(source.content, {
                    strictMode: false,
                    resolveReferences: true,
                    validateSchema: true
                })
                break

            default:
                throw new ParserError(`不支持的输入源类型: ${source.type}`, 'UNSUPPORTED_SOURCE_TYPE')
        }

        const spec = parseResult.spec

        // 提取 API 基本信息
        const apiInfo: OpenApiInfo = {
            title: spec.info.title,
            version: spec.info.version,
            description: spec.info.description,
            serverUrl: spec.servers?.[0]?.url,
            totalEndpoints: Object.keys(spec.paths).length
        }

        // 提取端点信息
        const endpoints: ApiEndpoint[] = []

        Object.entries(spec.paths).forEach(([path, pathItem]: [string, any]) => {
            if (!pathItem) return

            Object.entries(pathItem).forEach(([method, operation]: [string, any]) => {
                if (!operation || typeof operation !== 'object') return

                endpoints.push({
                    method: method.toUpperCase(),
                    path,
                    summary: operation.summary,
                    description: operation.description,
                    tags: operation.tags,
                    operationId: operation.operationId,
                    deprecated: operation.deprecated
                })
            })
        })

        return { apiInfo, endpoints }
    } catch (error) {
        throw new ParserError(
            `预览失败: ${error instanceof Error ? error.message : '未知错误'}`,
            'PREVIEW_ERROR'
        )
    }
}

/**
 * 转换为 MCP 格式
 */
export async function convertToMCP(
    source: InputSource,
    config: ConvertConfig
): Promise<ConvertResult> {
    if (!(await canUseRealParser())) {
        console.log('🔄 使用模拟转换模式')
        await mockDelay(1800)
        return mockConvertResult
    }

    console.log('🔄 使用真实解析器转换:', source.type, source.content)

    const startTime = Date.now()

    try {
        const { parseFromUrl, parseFromFile, parseFromString, transformToMCPTools } = await import('@mcp-swagger/parser')

        // 解析 OpenAPI 规范
        let parseResult: any

        switch (source.type) {
            case 'url':
                parseResult = await parseFromUrl(source.content, {
                    strictMode: false,
                    resolveReferences: true,
                    validateSchema: true
                })
                break

            case 'file':
                parseResult = await parseFromFile(source.content, {
                    strictMode: false,
                    resolveReferences: true,
                    validateSchema: true
                })
                break

            case 'text':
                parseResult = await parseFromString(source.content, {
                    strictMode: false,
                    resolveReferences: true,
                    validateSchema: true
                })
                break

            default:
                throw new ParserError(`不支持的输入源类型: ${source.type}`, 'UNSUPPORTED_SOURCE_TYPE')
        }

        const spec = parseResult.spec
        console.log('🔍 解析后的 OpenAPI 规范:', spec);
        
        // 配置转换选项
        const transformerOptions = {
            baseUrl: source.content.startsWith('http') ? undefined : 'http://localhost:3000',
            includeDeprecated: config.filters.includeDeprecated,
            includeTags: config.filters.tags.length > 0 ? config.filters.tags : undefined,
            requestTimeout: 30000,
            pathPrefix: ''
        }

        // 执行转换
        let tools = transformToMCPTools(spec, transformerOptions)

        // 应用方法过滤
        if (config.filters.methods.length > 0) {
            tools = tools.filter((tool: any) =>
                config.filters.methods.includes(tool.metadata?.method || '')
            )
        }

        // 获取 API 信息
        const { apiInfo, endpoints } = await previewOpenAPISpec(source)

        // 生成 MCP 配置
        const mcpConfig = {
            mcpServers: {
                [apiInfo.title.toLowerCase().replace(/\s+/g, '-')]: {
                    command: 'node',
                    args: ['dist/index.js'],
                    env: {
                        API_BASE_URL: apiInfo.serverUrl || 'http://localhost:3000'
                    }
                }
            },
            tools: tools.map((tool: any) => ({
                name: tool.name,
                description: tool.description,
                inputSchema: tool.inputSchema
            }))
        }

        const processingTime = Date.now() - startTime

        return {
            mcpConfig,
            metadata: {
                apiInfo,
                stats: {
                    totalEndpoints: endpoints.length,
                    convertedTools: tools.length,
                    skippedEndpoints: endpoints.length - tools.length
                }
            },
            processingTime
        }
    } catch (error) {
        throw new ParserError(
            `转换失败: ${error instanceof Error ? error.message : '未知错误'}`,
            'CONVERT_ERROR'
        )
    }
}

/**
 * 获取可用的标签列表
 */
export async function getAvailableTags(source: InputSource): Promise<string[]> {
    try {
        const { endpoints } = await previewOpenAPISpec(source)
        const tags = new Set<string>()

        endpoints.forEach(endpoint => {
            endpoint.tags?.forEach(tag => tags.add(tag))
        })

        return Array.from(tags).sort()
    } catch (error) {
        console.warn('获取标签失败:', error)
        return []
    }
}

/**
 * 获取统计信息
 */
export async function getParserStats(source: InputSource): Promise<{
    parseTime: number
    specVersion: string
    pathCount: number
    operationCount: number
    schemaCount: number
    validationErrors: number
    validationWarnings: number
}> {
    if (!(await canUseRealParser())) {
        console.log('🔄 使用模拟统计模式')
        await mockDelay(500)
        return {
            parseTime: 450,
            specVersion: '3.0.1',
            pathCount: 8,
            operationCount: 8,
            schemaCount: 12,
            validationErrors: 0,
            validationWarnings: 1
        }
    }

    console.log('🔄 使用真实解析器获取统计信息:', source.type, source.content)

    const startTime = Date.now()

    try {
        const validation = await validateOpenAPISpec(source)
        const { apiInfo } = await previewOpenAPISpec(source)
        const parseTime = Date.now() - startTime

        return {
            parseTime,
            specVersion: '3.0.1', // 简化版本检测
            pathCount: apiInfo.totalEndpoints || 0,
            operationCount: apiInfo.totalEndpoints || 0,
            schemaCount: 0, // 简化实现
            validationErrors: validation.errors.length,
            validationWarnings: validation.warnings.length
        }
    } catch (error) {
        return {
            parseTime: Date.now() - startTime,
            specVersion: 'unknown',
            pathCount: 0,
            operationCount: 0,
            schemaCount: 0,
            validationErrors: 1,
            validationWarnings: 0
        }
    }
}
