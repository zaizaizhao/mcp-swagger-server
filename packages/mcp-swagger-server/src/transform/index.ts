// Re-export everything from the mcp-swagger-parser package
export * from 'mcp-swagger-parser';

// For backward compatibility, re-export with the old function name
export { transformToMCPTools as transformOpenApiToMcpTools } from 'mcp-swagger-parser';