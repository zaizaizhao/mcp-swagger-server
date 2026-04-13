import { join } from 'path';
import * as fs from 'fs';
import { parseFromFile, parseFromString, transformToMCPTools } from 'mcp-swagger-parser';
import type { MCPTool, ValidationError, AuthConfig } from 'mcp-swagger-parser';
import { isServerDebugEnabled, serverDebugLog, serverWarnLog } from '../utils/logger';

export async function transformOpenApiToMcpTools(
  swaggerFilePath?: string,
  baseUrl?: string,
  openApiData?: any,
  authConfig?: AuthConfig,
  customHeaders?: any,
  debugHeaders?: boolean,
  operationFilter?: any,
  sourceOrigin?: string,
): Promise<MCPTool[]> {
  try {
    let parseResult: any;
    const debugEnabled = isServerDebugEnabled(Boolean(debugHeaders));

    if (openApiData) {
      serverDebugLog('Processing provided OpenAPI data...');
      const dataString = typeof openApiData === 'string' ? openApiData : JSON.stringify(openApiData);
      parseResult = await parseFromString(dataString, {
        strictMode: false,
        resolveReferences: true,
        validateSchema: true,
      });
    } else {
      const defaultPath = join(__dirname, '../swagger_json_file/swagger.json');
      const filePath = swaggerFilePath || defaultPath;

      if (!fs.existsSync(filePath)) {
        if (swaggerFilePath) {
          throw new Error(`OpenAPI file does not exist: ${filePath}`);
        }

        serverWarnLog('OpenAPI data not provided and default swagger.json not found, no tools will be generated');
        return [];
      }

      serverDebugLog(`Loading OpenAPI specification from: ${filePath}`);
      parseResult = await parseFromFile(filePath, {
        strictMode: false,
        resolveReferences: true,
        validateSchema: true,
      });
    }

    if (!parseResult.validation.valid) {
      serverWarnLog('OpenAPI spec validation warnings:');
      parseResult.validation.errors.forEach((error: ValidationError) => {
        serverWarnLog(`  - ${error.path}: ${error.message} (${error.code})`);
      });
    }

    serverDebugLog(`Loaded OpenAPI spec: ${parseResult.spec.info.title} v${parseResult.spec.info.version}`);
    serverDebugLog(`Found ${Object.keys(parseResult.spec.paths).length} API paths`);

    if (debugEnabled) {
      serverDebugLog('\n[DEBUG] MCP tool transform config:');
      if (operationFilter) {
        serverDebugLog('- operationFilter enabled');
        serverDebugLog('- operationFilter details:', JSON.stringify(operationFilter, null, 2));
      } else {
        serverDebugLog('- no operationFilter, all operations will be converted');
      }
    }

    const tools = transformToMCPTools(parseResult.spec, {
      baseUrl,
      sourceOrigin,
      includeDeprecated: false,
      requestTimeout: 30000,
      pathPrefix: '',
      authConfig,
      customHeaders,
      debugHeaders,
      operationFilter,
    });

    if (debugEnabled) {
      serverDebugLog('\n[DEBUG] MCP tool transform result:');
      serverDebugLog(`- source path count: ${Object.keys(parseResult.spec.paths).length}`);
      serverDebugLog(`- generated tool count: ${tools.length}`);
      if (operationFilter && tools.length > 0) {
        serverDebugLog('- generated tools:');
        tools.forEach((tool, index) => {
          serverDebugLog(`  ${index + 1}. ${tool.name} (${tool.description || 'No description'})`);
        });
      }
    }

    serverDebugLog(`Generated ${tools.length} MCP tools`);
    return tools;
  } catch (error) {
    serverWarnLog('Failed to transform OpenAPI to MCP tools:', error);
    throw error;
  }
}
