// Dashboard module exports
export { default as Dashboard } from './Dashboard.vue'

// Dashboard types and interfaces
export interface DashboardMetrics {
  cpu: number
  memory: number
  activeServers: number
  totalRequests: number
}

export interface SystemStatus {
  status: 'healthy' | 'warning' | 'error'
  uptime: number
  version: string
}
