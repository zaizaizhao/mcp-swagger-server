import { createHash } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { transformOpenApiToMcpTools, MCPTool } from "../transform";
import { AuthConfig } from 'mcp-swagger-parser';
import type { CallToolResult, ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { isServerDebugEnabled, serverDebugLog, serverWarnLog } from "../utils/logger";

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
  sourceOrigin?: string,
) {
  const debugEnabled = isServerDebugEnabled(Boolean(debugHeaders));
  serverDebugLog('Initializing MCP tools...');

  try {
    if (!openApiData) {
      serverWarnLog('OpenAPI data not provided, attempting default swagger.json if available');
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

    await registerTools(server, preparedTools);

    if (debugEnabled) {
      serverDebugLog('Tool initialization completed');
    }
  } catch (error) {
    serverWarnLog('Tool initialization failed:', error);

    if ((error as any)?.code === 'VALIDATION_ERROR' && !openApiData) {
      serverDebugLog('Retrying tool initialization with default configuration...');
      try {
        const preparedTools = await getPreparedTools();
        await registerTools(server, preparedTools);
        serverDebugLog('Default configuration initialization completed');
        return;
      } catch (fallbackError) {
        serverWarnLog('Default configuration initialization failed:', fallbackError);
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
    `sourceOrigin=${getCacheToken(options.sourceOrigin)}`,
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

async function buildPreparedTools(options: ToolInitializationOptions = {}): Promise<PreparedToolRegistration[]> {
  const debugEnabled = isServerDebugEnabled(Boolean(options.debugHeaders));
  const tools = await transformOpenApiToMcpTools(
    undefined,
    options.baseUrl,
    options.openApiData,
    options.authConfig,
    options.customHeaders,
    options.debugHeaders,
    options.operationFilter,
    options.sourceOrigin,
  );

  serverDebugLog(`Prepared ${tools.length} tools`);
  if (debugEnabled) {
    printToolsSummary(tools);
  }

  return tools.map((tool) => ({
    tool,
    registration: {
      title: tool.metadata ? `${tool.metadata.method} ${tool.metadata.path}` : undefined,
      description: tool.description,
      inputSchema: convertInputSchemaToZod(tool.inputSchema),
      annotations: buildToolAnnotations(tool.metadata),
    },
  }));
}

async function getPreparedTools(options: ToolInitializationOptions = {}): Promise<PreparedToolRegistration[]> {
  const cacheKey = buildPreparedToolCacheKey(options);
  if (!cacheKey) {
    return buildPreparedTools(options);
  }

  const cachedPreparedTools = preparedToolCache.get(cacheKey);
  if (cachedPreparedTools) {
    preparedToolCache.delete(cacheKey);
    preparedToolCache.set(cacheKey, cachedPreparedTools);

    const preparedTools = await cachedPreparedTools;
    serverDebugLog(`Reused ${preparedTools.length} cached MCP tool definitions`);
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

function printToolsSummary(tools: MCPTool[]) {
  serverDebugLog('\nTool summary:');
  serverDebugLog('─'.repeat(80));

  const toolsByTag: Record<string, any[]> = {};

  for (const tool of tools) {
    const tags = tool.metadata?.tags || ['uncategorized'];
    for (const tag of tags) {
      if (!toolsByTag[tag]) {
        toolsByTag[tag] = [];
      }
      toolsByTag[tag].push(tool);
    }
  }

  for (const [tag, tagTools] of Object.entries(toolsByTag)) {
    serverDebugLog(`\n${tag} (${tagTools.length} tools):`);

    for (const tool of tagTools.slice(0, 5)) {
      const method = tool.metadata?.method || 'UNKNOWN';
      const path = tool.metadata?.path || '';
      serverDebugLog(`  • ${tool.name} - ${method} ${path}`);
      serverDebugLog(`    ${tool.description}`);
    }

    if (tagTools.length > 5) {
      serverDebugLog(`  ... and ${tagTools.length - 5} more tools`);
    }
  }

  serverDebugLog('─'.repeat(80));
  serverDebugLog(`Total generated tools: ${tools.length}`);

  if (tools.length > 0) {
    const exampleTool = tools[0];
    serverDebugLog(`\nExample tool: ${exampleTool.name}`);
    serverDebugLog(`Description: ${exampleTool.description}`);
    serverDebugLog('Input schema:', JSON.stringify(exampleTool.inputSchema, null, 2));
  }
}

async function registerTools(server: McpServer, preparedTools: PreparedToolRegistration[]): Promise<void> {
  serverDebugLog(`Registering ${preparedTools.length} tools into MCP Server...`);

  let successCount = 0;
  let errorCount = 0;

  for (const { tool, registration } of preparedTools) {
    try {
      server.registerTool(
        tool.name,
        registration,
        async (args: Record<string, unknown>): Promise<CallToolResult> =>
          (await tool.handler(args)) as unknown as CallToolResult,
      );

      successCount++;
      serverDebugLog(`Registered tool: ${tool.name} (${tool.metadata?.method} ${tool.metadata?.path})`);
    } catch (error) {
      errorCount++;
      serverWarnLog(`Failed to register tool: ${tool.name}`, error);
    }
  }

  serverDebugLog(
    `Tool registration complete: success=${successCount}, failed=${errorCount}, total=${preparedTools.length}`,
  );
}

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
    openWorldHint: true,
  };
}

function convertSchemaNodeToZod(schema?: JsonSchemaProperty): z.ZodTypeAny {
  if (!schema) {
    return z.unknown();
  }

  let zodType: z.ZodTypeAny;

  switch (schema.type) {
    case 'string': {
      if (
        schema.enum &&
        schema.enum.every((value): value is string => typeof value === 'string') &&
        schema.enum.length > 0
      ) {
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
        additionalProperties: schema.additionalProperties,
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

    if (!isRequired) {
      zodType = zodType.optional();
    }

    zodSchema[propName] = zodType;
  }

  return zodSchema;
}
