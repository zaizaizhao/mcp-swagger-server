// Servers module exports
export { default as ServerManager } from './ServerManager.vue'
export { default as ServerDetail } from './ServerDetail.vue'

// Server components
export { default as ServerFormDialog } from './components/ServerFormDialog.vue'

// Server types and interfaces
export interface MCPServer {
  id: string
  name: string
  command: string[]
  args?: string[]
  env?: Record<string, string>
  status: 'running' | 'stopped' | 'error'
  tools?: MCPTool[]
  createdAt: Date
  updatedAt: Date
}

export interface MCPTool {
  name: string
  description?: string
  inputSchema?: any
}
