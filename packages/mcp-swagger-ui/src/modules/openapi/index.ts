// OpenAPI module exports
export { default as OpenAPIManager } from './OpenAPIManager.vue'

// OpenAPI components
export { default as MCPToolPreview } from './components/openapi/MCPToolPreview.vue'

// OpenAPI types and interfaces
export interface OpenAPISpec {
  openapi: string
  info: {
    title: string
    version: string
    description?: string
  }
  paths: Record<string, any>
  components?: any
}

export interface MCPTool {
  name: string
  description?: string
  inputSchema?: any
}

export interface ConversionResult {
  success: boolean
  tools?: MCPTool[]
  errors?: string[]
  warnings?: string[]
}
