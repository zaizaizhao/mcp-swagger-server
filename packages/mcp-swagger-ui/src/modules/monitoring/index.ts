// Monitoring module exports
export { default as MonitoringDashboard } from './monitoring/Dashboard.vue'

// Monitoring types and interfaces
export interface MetricData {
  timestamp: Date
  value: number
  label?: string
}

export interface SystemMetrics {
  cpu: MetricData[]
  memory: MetricData[]
  network: MetricData[]
  requests: MetricData[]
}

export interface Alert {
  id: string
  type: 'warning' | 'error' | 'info'
  title: string
  message: string
  timestamp: Date
  resolved: boolean
}
