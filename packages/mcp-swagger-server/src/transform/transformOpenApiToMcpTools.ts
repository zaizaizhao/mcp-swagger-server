import { join } from 'path';
import { parseFromFile, parseFromString, transformToMCPTools } from '@mcp-swagger/parser';
import type { MCPTool, ValidationError } from '@mcp-swagger/parser';

/**
 * 主转换函数 - 使用新的 mcp-swagger-parser
 */
export async function transformOpenApiToMcpTools(
  swaggerFilePath?: string,
  baseUrl?: string,
  openApiData?: any
): Promise<MCPTool[]> {
  try {
    let parseResult: any;
    
    if (openApiData) {
      // 如果提供了 OpenAPI 数据，直接使用
      console.log(`🔄 Processing provided OpenAPI data...`);
      const dataString = typeof openApiData === 'string' ? openApiData : JSON.stringify(openApiData);
      parseResult = await parseFromString(dataString, {
        strictMode: false,
        resolveReferences: true,
        validateSchema: true
      });
    } else {
      // 默认路径
      const defaultPath = join(__dirname, '../swagger_json_file/swagger.json');
      const filePath = swaggerFilePath || defaultPath;
      
      console.log(`🔄 Loading OpenAPI specification from: ${filePath}`);
      // 使用新的解析器解析 OpenAPI 规范
      parseResult = await parseFromFile(filePath, {
        strictMode: false,
        resolveReferences: true,
        validateSchema: true
      });
    }
    
    // 检查解析是否成功
    if (!parseResult.validation.valid) {
      console.warn('⚠️ OpenAPI spec validation warnings:');
      parseResult.validation.errors.forEach((error: ValidationError) => {
        console.warn(`  - ${error.path}: ${error.message} (${error.code})`);
      });
    }
    
    console.log(`✅ Loaded OpenAPI spec: ${parseResult.spec.info.title} v${parseResult.spec.info.version}`);
    console.log(`📊 Found ${Object.keys(parseResult.spec.paths).length} API paths`);
    
    // 转换为 MCP 工具
    const tools = transformToMCPTools(parseResult.spec, {
      baseUrl,
      includeDeprecated: false,
      requestTimeout: 30000,
      pathPrefix: ''
    });
    
    console.log(`🎉 Generated ${tools.length} MCP tools`);
    
    return tools;
    
  } catch (error) {
    console.error('❌ Failed to transform OpenAPI to MCP tools:', error);
    throw error;
  }
}