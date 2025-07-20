// Shared components exports
export * from './components'

// Shared types and utilities
export interface BaseEntity {
  id: string
  createdAt: Date
  updatedAt: Date
}

export interface PaginationOptions {
  page: number
  pageSize: number
  total: number
}

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface SelectOption {
  label: string
  value: string | number
  disabled?: boolean
}
