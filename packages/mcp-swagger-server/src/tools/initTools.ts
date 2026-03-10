import { createHash } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { transformOpenApiToMcpTools, MCPTool } from "../transform";
import { AuthConfig } from 'mcp-swagger-parser';
import type { CallToolResult, ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";

interface ToolInitializationOptions {
  openApiData?: any;
  authConfig?: AuthConfig;
  customHeaders?: any;
  debugHeaders?: boolean;
  operationFilter?: any;
  baseUrl?: string;
  sourceOrigin?: string;
}

interface PreparedToolRegistration {
  tool: MCPTool;
  registration: {
    title?: string;
    description: string;
    inputSchema: z.ZodRawShape;
    annotations?: ToolAnnotations;
  };
}

const MAX_PREPARED_TOOL_CACHE_ENTRIES = 16;
const preparedToolCache = new Map<string, Promise<PreparedToolRegistration[]>>();
const objectCacheTokens = new WeakMap<object, number>();
let nextObjectCacheToken = 1;

export async function initTools(
  server: McpServer,
  openApiData?: any,
  authConfig?: AuthConfig,
  customHeaders?: any,
  debugHeaders?: boolean,
  operationFilter?: any,
  baseUrl?: string,
  sourceOrigin?: string
) {
    console.log("🔧 初始化 MCP 工具...");
    
    try {
        // 如果没有提供 openApiData，使用默认的 swagger.json
        if (!openApiData) {
            console.log("⚠️ 未提供 OpenAPI 数据，将尝试使用默认的 swagger.json 文件（若存在）");
        }
        
        const preparedTools = await getPreparedTools({
          openApiData,
          authConfig,
          customHeaders,
          debugHeaders,
          operationFilter,
          baseUrl,
          sourceOrigin,
        });
        
        // 批量注册工具到 MCP Server
        await registerTools(server, preparedTools);
        
        console.log("✅ 工具初始化完成");
        
    } catch (error) {
        console.error("❌ 初始化工具失败:", error);
        
        // 如果是解析错误且没有提供 openApiData，尝试使用默认配置
        if ((error as any)?.code === 'VALIDATION_ERROR' && !openApiData) {
            console.log("🔄 尝试使用默认配置重新初始化...");
            try {
                const preparedTools = await getPreparedTools();
                await registerTools(server, preparedTools);
                console.log("✅ 使用默认配置初始化完成");
                return;
            } catch (fallbackError) {
                console.error("❌ 默认配置初始化也失败:", fallbackError);
            }
        }
        
        throw error;
    }
}

function getObjectCacheToken(value: object): number {
    const cachedToken = objectCacheTokens.get(value);
    if (cachedToken !== undefined) {
        return cachedToken;
    }

    const nextToken = nextObjectCacheToken++;
    objectCacheTokens.set(value, nextToken);
    return nextToken;
}

function getCacheToken(value: unknown): string {
    if (value === undefined) {
        return 'undefined';
    }

    if (value === null) {
        return 'null';
    }

    switch (typeof value) {
        case 'string':
            return `string:${createHash('sha256').update(value).digest('hex')}`;
        case 'number':
        case 'boolean':
        case 'bigint':
            return `${typeof value}:${String(value)}`;
        case 'object':
        case 'function':
            return `ref:${getObjectCacheToken(value as object)}`;
        default:
            return `${typeof value}:${String(value)}`;
    }
}

function buildPreparedToolCacheKey(options: ToolInitializationOptions): string | undefined {
    if (options.openApiData === undefined) {
        return undefined;
    }

    return [
        `openApi=${getCacheToken(options.openApiData)}`,
        `auth=${getCacheToken(options.authConfig)}`,
        `customHeaders=${getCacheToken(options.customHeaders)}`,
        `debugHeaders=${getCacheToken(Boolean(options.debugHeaders))}`,
        `operationFilter=${getCacheToken(options.operationFilter)}`,
        `baseUrl=${getCacheToken(options.baseUrl)}`,
        `sourceOrigin=${getCacheToken(options.sourceOrigin)}`
    ].join('|');
}

function prunePreparedToolCache(): void {
    while (preparedToolCache.size > MAX_PREPARED_TOOL_CACHE_ENTRIES) {
        const oldestCacheKey = preparedToolCache.keys().next().value;
        if (!oldestCacheKey) {
            break;
        }

        preparedToolCache.delete(oldestCacheKey);
    }
}

async function buildPreparedTools(
    options: ToolInitializationOptions = {}
): Promise<PreparedToolRegistration[]> {
    const tools = await transformOpenApiToMcpTools(
        undefined,
        options.baseUrl,
        options.openApiData,
        options.authConfig,
        options.customHeaders,
        options.debugHeaders,
        options.operationFilter,
        options.sourceOrigin
    );

    console.log(`📦 成功生成 ${tools.length} 个工具`);
    printToolsSummary(tools);

    return tools.map((tool) => ({
        tool,
        registration: {
            title: tool.metadata ? `${tool.metadata.method} ${tool.metadata.path}` : undefined,
            description: tool.description,
            inputSchema: convertInputSchemaToZod(tool.inputSchema),
            annotations: buildToolAnnotations(tool.metadata)
        }
    }));
}

async function getPreparedTools(
    options: ToolInitializationOptions = {}
): Promise<PreparedToolRegistration[]> {
    const cacheKey = buildPreparedToolCacheKey(options);
    if (!cacheKey) {
        return buildPreparedTools(options);
    }

    const cachedPreparedTools = preparedToolCache.get(cacheKey);
    if (cachedPreparedTools) {
        preparedToolCache.delete(cacheKey);
        preparedToolCache.set(cacheKey, cachedPreparedTools);

        const preparedTools = await cachedPreparedTools;
        console.log(`♻️ 复用缓存的 ${preparedTools.length} 个 MCP 工具定义`);
        return preparedTools;
    }

    const preparedToolsPromise = buildPreparedTools(options).catch((error) => {
        preparedToolCache.delete(cacheKey);
        throw error;
    });

    preparedToolCache.set(cacheKey, preparedToolsPromise);
    prunePreparedToolCache();

    return preparedToolsPromise;
}

/**
 * 打印工具摘要
 */
function printToolsSummary(tools: MCPTool[]) {
    console.log("\n📊 工具摘要:");
    console.log("─".repeat(80));
    
    // 按标签分组
    const toolsByTag: Record<string, any[]> = {};
    
    for (const tool of tools) {
        const tags = tool.metadata?.tags || ['未分类'];
        for (const tag of tags) {
            if (!toolsByTag[tag]) {
                toolsByTag[tag] = [];
            }
            toolsByTag[tag].push(tool);
        }
    }
    
    for (const [tag, tagTools] of Object.entries(toolsByTag)) {
        console.log(`\n📂 ${tag} (${tagTools.length} 个工具):`);
        
        for (const tool of tagTools.slice(0, 5)) { // 只显示前5个
            const method = tool.metadata?.method || 'UNKNOWN';
            const path = tool.metadata?.path || '';
            console.log(`  • ${tool.name} - ${method} ${path}`);
            console.log(`    ${tool.description}`);
        }
        
        if (tagTools.length > 5) {
            console.log(`  ... 还有 ${tagTools.length - 5} 个工具`);
        }
    }
      console.log("─".repeat(80));
    console.log(`🎯 总计: ${tools.length} 个工具已生成`);
    
    // 显示工具示例
    if (tools.length > 0) {
        const exampleTool = tools[0];
        console.log(`\n💡 工具示例: ${exampleTool.name}`);
        console.log(`📝 描述: ${exampleTool.description}`);
        console.log(`📋 输入模式:`, JSON.stringify(exampleTool.inputSchema, null, 2));
    }
}

/**
 * 批量注册工具到 MCP Server
 * @param server MCP Server 实例
 * @param tools 从 OpenAPI 转换的工具列表
 */
async function registerTools(server: McpServer, preparedTools: PreparedToolRegistration[]): Promise<void> {
    console.log(`🔗 开始注册 ${preparedTools.length} 个工具到 MCP Server...`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const { tool, registration } of preparedTools) {
        try {            // 使用 MCP Server 的 registerTool API 注册工具
            server.registerTool(
                tool.name,
                registration,
                async (args: Record<string, unknown>): Promise<CallToolResult> =>
                    (await tool.handler(args)) as unknown as CallToolResult
            );
            
            successCount++;
            console.log(`✅ 已注册工具: ${tool.name} (${tool.metadata?.method} ${tool.metadata?.path})`);
            
        } catch (error) {
            errorCount++;
            console.error(`❌ 注册工具失败: ${tool.name}`, error);
        }
    }
    
    console.log(`\n📊 工具注册完成:`);
    console.log(`  ✅ 成功: ${successCount} 个`);
    console.log(`  ❌ 失败: ${errorCount} 个`);
    console.log(`  📦 总计: ${preparedTools.length} 个工具`);
}

/**
 * 将 JSON Schema 形式的 inputSchema 转换为 Zod schema
 * @param inputSchema JSON Schema 格式的输入模式
 * @returns Zod schema 对象
 */
type JsonSchemaProperty = {
    type?: string;
    enum?: unknown[];
    description?: string;
    properties?: Record<string, JsonSchemaProperty>;
    items?: JsonSchemaProperty;
    required?: string[];
    additionalProperties?: boolean;
};

function buildToolAnnotations(metadata?: MCPTool['metadata']): ToolAnnotations | undefined {
    if (!metadata?.method) {
        return undefined;
    }

    const method = metadata.method.toUpperCase();
    const readOnlyHint = method === 'GET' || method === 'HEAD' || method === 'OPTIONS';
    const destructiveHint = method === 'DELETE';
    const idempotentHint = readOnlyHint || method === 'PUT' || method === 'DELETE';

    return {
        readOnlyHint,
        destructiveHint,
        idempotentHint,
        openWorldHint: true
    };
}

function convertSchemaNodeToZod(schema?: JsonSchemaProperty): z.ZodTypeAny {
    if (!schema) {
        return z.unknown();
    }

    let zodType: z.ZodTypeAny;

    switch (schema.type) {
        case 'string': {
            if (schema.enum && schema.enum.every((value): value is string => typeof value === 'string') && schema.enum.length > 0) {
                const [firstValue, ...restValues] = schema.enum;
                zodType = z.enum([firstValue, ...restValues]);
            } else {
                zodType = z.string();
            }
            break;
        }
        case 'number':
            zodType = z.number();
            break;
        case 'integer':
            zodType = z.number().int();
            break;
        case 'boolean':
            zodType = z.boolean();
            break;
        case 'array':
            zodType = z.array(convertSchemaNodeToZod(schema.items));
            break;
        case 'object': {
            const shape = convertInputSchemaToZod({
                type: 'object',
                properties: schema.properties ?? {},
                required: schema.required,
                additionalProperties: schema.additionalProperties
            });

            const objectSchema = z.object(shape);
            zodType = schema.additionalProperties === false ? objectSchema.strict() : objectSchema.passthrough();
            break;
        }
        default:
            zodType = z.unknown();
            break;
    }

    if (schema.description) {
        zodType = zodType.describe(schema.description);
    }

    return zodType;
}

function convertInputSchemaToZod(inputSchema: MCPTool['inputSchema']): z.ZodRawShape {
    if (!inputSchema || !inputSchema.properties) {
        return {};
    }
    
    const zodSchema: z.ZodRawShape = {};
    
    for (const [propName, propDef] of Object.entries(inputSchema.properties)) {
        const isRequired = inputSchema.required?.includes(propName) ?? false;
        let zodType = convertSchemaNodeToZod(propDef as JsonSchemaProperty);
        
        // 处理可选字段
        if (!isRequired) {
            zodType = zodType.optional();
        }

        zodSchema[propName] = zodType;
    }
    
    return zodSchema;
}
