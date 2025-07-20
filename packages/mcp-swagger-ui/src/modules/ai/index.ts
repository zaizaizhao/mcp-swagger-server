// AI module exports
export { default as AIAssistant } from './AIAssistant.vue'

// AI types and interfaces
export interface AIConfig {
  id: string
  name: string
  provider: 'openai' | 'anthropic' | 'google' | 'custom'
  model: string
  apiKey: string
  baseUrl?: string
  temperature?: number
  maxTokens?: number
  systemPrompt?: string
  enabled: boolean
  createdAt: Date
  updatedAt: Date
}

export interface AITemplate {
  id: string
  name: string
  description: string
  category: string
  config: Partial<AIConfig>
  isBuiltIn: boolean
}
