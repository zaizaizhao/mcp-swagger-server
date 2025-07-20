// Testing module exports
export { default as APITester } from './APITester.vue'

// Testing components
export { default as ToolDetailDialog } from './components/ToolDetailDialog.vue'

// Testing types and interfaces
export interface TestCase {
  id: string
  name: string
  toolName: string
  parameters: Record<string, any>
  expectedResult?: any
  tags?: string[]
  createdAt: Date
}

export interface TestResult {
  success: boolean
  result?: any
  error?: string
  duration: number
  timestamp: Date
}
