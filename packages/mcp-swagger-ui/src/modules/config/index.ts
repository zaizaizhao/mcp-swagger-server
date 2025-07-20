// Config module exports
export { default as ConfigManager } from './ConfigManager.vue'
export { default as ConfigManagerNew } from './ConfigManagerNew.vue'

// Config components
export { default as BackupManager } from './components/BackupManager.vue'
export { default as ConfigMigrationWizard } from './components/ConfigMigrationWizard.vue'
export { default as ConflictResolver } from './components/ConflictResolver.vue'

// Config types and interfaces
export interface ConfigExport {
  version: string
  timestamp: Date
  servers: any[]
  auth: any[]
  openapi: any[]
  settings: Record<string, any>
}

export interface ConfigImportResult {
  success: boolean
  imported: {
    servers: number
    auth: number
    openapi: number
  }
  conflicts?: any[]
  errors?: string[]
}
