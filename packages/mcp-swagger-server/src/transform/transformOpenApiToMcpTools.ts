import { join } from 'path';
import { parseFromFile, parseFromString, transformToMCPTools } from 'mcp-swagger-parser';
import type { MCPTool, ValidationError, AuthConfig } from 'mcp-swagger-parser';

/**
 * 主转换函数 - 使用新的 mcp-swagger-parser
 */
export async function transformOpenApiToMcpTools(
  swaggerFilePath?: string,
  baseUrl?: string,
  openApiData?: any,
  authConfig?: AuthConfig,
  customHeaders?: any,
  debugHeaders?: boolean,
  operationFilter?: any
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
    
    // 调试输出：显示operationFilter信息
    console.log(`\n[DEBUG] MCP工具转换配置:`);
    if (operationFilter) {
      console.log(`- 使用operationFilter进行接口过滤`);
      console.log(`- operationFilter详情:`, JSON.stringify(operationFilter, null, 2));
      
      // 显示过滤器的具体配置
      if (operationFilter.methods) {
        console.log(`- 方法过滤: include=${operationFilter.methods.include?.join(', ') || 'N/A'}, exclude=${operationFilter.methods.exclude?.join(', ') || 'N/A'}`);
      }
      if (operationFilter.paths) {
        console.log(`- 路径过滤: include=${operationFilter.paths.include?.length || 0}个路径, exclude=${operationFilter.paths.exclude?.length || 0}个路径`);
      }
      if (operationFilter.operationIds) {
        console.log(`- 操作ID过滤: include=${operationFilter.operationIds.include?.length || 0}个ID, exclude=${operationFilter.operationIds.exclude?.length || 0}个ID`);
      }
      if (operationFilter.customFilter) {
        console.log(`- 使用自定义过滤函数`);
      }
    } else {
      console.log(`- 未设置operationFilter，将转换所有接口`);
    }
    
    // 转换为 MCP 工具
    const tools = transformToMCPTools(parseResult.spec, {
      baseUrl,
      includeDeprecated: false,
      requestTimeout: 30000,
      pathPrefix: '',
      authConfig, // 传递认证配置
      customHeaders, // 传递自定义请求头配置
      debugHeaders, // 传递调试选项
      operationFilter // 传递操作过滤配置
    });

    // 调试输出：显示最终转换结果
    console.log(`\n[DEBUG] MCP工具转换结果:`);
    console.log(`- 原始API路径数量: ${Object.keys(parseResult.spec.paths).length}`);
    console.log(`- 最终生成的MCP工具数量: ${tools.length}`);
    
    if (operationFilter && tools.length > 0) {
      console.log(`- 转换后的工具列表:`);
      tools.forEach((tool, index) => {
        console.log(`  ${index + 1}. ${tool.name} (${tool.description || 'No description'})`);
      });
    }
    
    console.log(`🎉 Generated ${tools.length} MCP tools`);
    
    return tools;
    
  } catch (error) {
    console.error('❌ Failed to transform OpenAPI to MCP tools:', error);
    throw error;
  }
}