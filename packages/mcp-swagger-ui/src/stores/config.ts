import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { useAppStore } from './app'

// 配置导入导出相关类型
export interface ConfigExportOptions {
  types: string[]
  format: 'json' | 'yaml' | 'zip'
  sensitiveData: 'exclude' | 'encrypt' | 'include'
  password?: string
  notes?: string
}

export interface ConfigImportResult {
  success: boolean
  message: string
  appliedCounts?: Record<string, number>
  errors?: string[]
  warnings?: string[]
}

export interface ConfigValidationResult {
  valid: boolean
  configCounts: Record<string, number>
  errors: Array<{ id: string; message: string; details: string }>
  warnings: Array<{ id: string; message: string; details: string }>
}

export interface ConfigConflict {
  id: string
  type: string
  title: string
  current: any
  incoming: any
  resolution: 'keep' | 'replace' | 'merge'
}

export interface ConfigMigrationResult {
  success: boolean
  fromVersion: string
  toVersion: string
  migratedCounts: Record<string, number>
  warnings: string[]
  errors: string[]
}

export interface ConfigVersionInfo {
  version: string
  compatibleVersions: string[]
  migrationPath?: string[]
  deprecated?: boolean
  features: string[]
}

export interface ConfigConflictResolution {
  conflictId: string
  resolution: 'keep' | 'replace' | 'merge' | 'custom'
  customValue?: any
  description?: string
}

export interface ConfigMigrationStep {
  id: string
  name: string
  description: string
  fromVersion: string
  toVersion: string
  required: boolean
  executed: boolean
  result?: {
    success: boolean
    message: string
    data?: any
  }
}

export interface ConfigBackup {
  id: string
  name: string
  timestamp: Date
  size: number
  types: string[]
  description?: string
  version?: string
}

export const useConfigStore = defineStore('config', () => {
  const appStore = useAppStore()
  
  // State
  const loading = ref(false)
  const error = ref<string | null>(null)
  const backups = ref<ConfigBackup[]>([])
  const exportHistory = ref<Array<{
    id: string
    timestamp: Date
    filename: string
    types: string[]
    success: boolean
  }>>([])
  
  // 迁移和冲突解决状态
  const migrationInProgress = ref(false)
  const currentVersion = ref('1.0.0')
  const availableVersions = ref<ConfigVersionInfo[]>([])
  const migrationSteps = ref<ConfigMigrationStep[]>([])
  const conflictResolutions = ref<ConfigConflictResolution[]>([])
  
  // Actions
  const setLoading = (value: boolean) => {
    loading.value = value
  }

  const setError = (value: string | null) => {
    error.value = value
    if (value) {
      appStore.addNotification({
        type: 'error',
        title: '配置管理错误',
        message: value,
        duration: 5000
      })
    }
  }

  const clearError = () => {
    error.value = null
  }

  // 导出配置
  const exportConfig = async (options: ConfigExportOptions): Promise<boolean> => {
    setLoading(true)
    clearError()
    
    try {
      // 模拟导出过程
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // 收集要导出的配置数据
      const exportData: Record<string, any> = {}
      
      for (const type of options.types) {
        exportData[type] = await getConfigData(type)
      }
      
      // 处理敏感信息
      if (options.sensitiveData === 'exclude') {
        removeSensitiveData(exportData)
      } else if (options.sensitiveData === 'encrypt' && options.password) {
        encryptSensitiveData(exportData, options.password)
      }
      
      // 生成文件
      const filename = generateFilename(options.format)
      const content = formatContent(exportData, options.format)
      
      // 下载文件
      downloadFile(content, filename, getMimeType(options.format))
      
      // 记录导出历史
      exportHistory.value.unshift({
        id: `export_${Date.now()}`,
        timestamp: new Date(),
        filename,
        types: options.types,
        success: true
      })
      
      appStore.addNotification({
        type: 'success',
        title: '配置导出成功',
        message: `已导出配置文件: ${filename}`,
        duration: 3000
      })
      
      return true
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '导出失败'
      setError(errorMessage)
      return false
    } finally {
      setLoading(false)
    }
  }

  // 验证导入的配置
  const validateImportConfig = async (file: File): Promise<ConfigValidationResult> => {
    setLoading(true)
    
    try {
      const content = await readFileContent(file)
      const parsedConfig = parseConfigFile(content, file.name)
      
      // 验证配置结构
      const result = await validateConfigStructure(parsedConfig)
      
      return result
    } catch (error) {
      return {
        valid: false,
        configCounts: {},
        errors: [
          {
            id: 'parse_error',
            message: '配置文件解析失败',
            details: error instanceof Error ? error.message : '未知错误'
          }
        ],
        warnings: []
      }
    } finally {
      setLoading(false)
    }
  }

  // 检测配置冲突
  const detectConflicts = async (parsedConfig: any): Promise<ConfigConflict[]> => {
    const conflicts: ConfigConflict[] = []
    
    // 模拟冲突检测逻辑
    for (const [type, configs] of Object.entries(parsedConfig)) {
      if (Array.isArray(configs)) {
        for (const config of configs) {
          const existing = await findExistingConfig(type, config)
          if (existing) {
            conflicts.push({
              id: `${type}_${config.id || config.name}`,
              type,
              title: `${getConfigTypeLabel(type)} 配置冲突`,
              current: existing,
              incoming: config,
              resolution: 'keep'
            })
          }
        }
      }
    }
    
    return conflicts
  }

  // 应用导入的配置
  const applyImportConfig = async (
    parsedConfig: any,
    conflicts: ConfigConflict[]
  ): Promise<ConfigImportResult> => {
    setLoading(true)
    
    try {
      // 根据冲突解决方案处理配置
      const resolvedConfig = resolveConflicts(parsedConfig, conflicts)
      
      // 应用配置
      const appliedCounts: Record<string, number> = {}
      
      for (const [type, configs] of Object.entries(resolvedConfig)) {
        const count = await applyConfigType(type, configs)
        appliedCounts[type] = count
      }
      
      appStore.addNotification({
        type: 'success',
        title: '配置导入成功',
        message: `已成功导入配置`,
        duration: 3000
      })
      
      return {
        success: true,
        message: '配置导入完成',
        appliedCounts
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '导入失败'
      setError(errorMessage)
      
      return {
        success: false,
        message: errorMessage,
        errors: [errorMessage]
      }
    } finally {
      setLoading(false)
    }
  }

  // 创建配置备份
  const createBackup = async (name: string, types: string[], description?: string): Promise<string> => {
    setLoading(true)
    
    try {
      const backupData: Record<string, any> = {}
      
      for (const type of types) {
        backupData[type] = await getConfigData(type)
      }
      
      const backup: ConfigBackup = {
        id: `backup_${Date.now()}`,
        name,
        timestamp: new Date(),
        size: JSON.stringify(backupData).length,
        types,
        description
      }
      
      // 存储备份（实际项目中应存储到服务器或本地存储）
      backups.value.unshift(backup)
      
      appStore.addNotification({
        type: 'success',
        title: '备份创建成功',
        message: `已创建配置备份: ${name}`,
        duration: 3000
      })
      
      return backup.id
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '备份失败'
      setError(errorMessage)
      throw error
    } finally {
      setLoading(false)
    }
  }

  // 恢复配置备份
  const restoreBackup = async (backupId: string): Promise<boolean> => {
    setLoading(true)
    
    try {
      const backup = backups.value.find(b => b.id === backupId)
      if (!backup) {
        throw new Error('备份不存在')
      }
      
      // 模拟恢复过程
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      appStore.addNotification({
        type: 'success',
        title: '备份恢复成功',
        message: `已恢复配置备份: ${backup.name}`,
        duration: 3000
      })
      
      return true
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '恢复失败'
      setError(errorMessage)
      return false
    } finally {
      setLoading(false)
    }
  }

  // 检测配置版本
  const detectConfigVersion = (config: any): ConfigVersionInfo => {
    // 检测配置结构特征来判断版本
    const detectedVersion = detectVersionFromStructure(config)
    
    const versionInfo: ConfigVersionInfo = {
      version: detectedVersion,
      compatibleVersions: getCompatibleVersions(detectedVersion),
      features: getVersionFeatures(detectedVersion),
      deprecated: isVersionDeprecated(detectedVersion)
    }
    
    if (needsMigration(detectedVersion, currentVersion.value)) {
      versionInfo.migrationPath = getMigrationPath(detectedVersion, currentVersion.value)
    }
    
    return versionInfo
  }

  // 创建迁移计划
  const createMigrationPlan = (fromVersion: string, toVersion: string): ConfigMigrationStep[] => {
    const steps: ConfigMigrationStep[] = []
    const path = getMigrationPath(fromVersion, toVersion)
    
    for (let i = 0; i < path.length - 1; i++) {
      const from = path[i]
      const to = path[i + 1]
      
      steps.push({
        id: `migrate_${from}_to_${to}`,
        name: `从 ${from} 迁移到 ${to}`,
        description: getMigrationDescription(from, to),
        fromVersion: from,
        toVersion: to,
        required: isMigrationRequired(from, to),
        executed: false
      })
    }
    
    return steps
  }

  // 执行配置迁移
  const migrateConfig = async (
    config: any, 
    targetVersion: string,
    resolutions: ConfigConflictResolution[] = []
  ): Promise<ConfigMigrationResult> => {
    migrationInProgress.value = true
    
    try {
      const sourceVersion = detectVersionFromStructure(config)
      const steps = createMigrationPlan(sourceVersion, targetVersion)
      migrationSteps.value = steps
      
      let migratedConfig = { ...config }
      const migratedCounts: Record<string, number> = {}
      const warnings: string[] = []
      const errors: string[] = []
      
      // 执行每个迁移步骤
      for (const step of steps) {
        try {
          const result = await executeMigrationStep(migratedConfig, step, resolutions)
          step.executed = true
          step.result = result
          
          if (result.success) {
            migratedConfig = result.data
            // 统计迁移的配置项数量
            Object.keys(result.data).forEach(key => {
              if (Array.isArray(result.data[key])) {
                migratedCounts[key] = (migratedCounts[key] || 0) + result.data[key].length
              }
            })
          } else {
            errors.push(`步骤 ${step.name} 失败: ${result.message}`)
          }
        } catch (error) {
          step.result = {
            success: false,
            message: error instanceof Error ? error.message : '未知错误'
          }
          errors.push(`步骤 ${step.name} 执行异常: ${step.result.message}`)
        }
      }
      
      // 验证迁移后的配置
      const validation = await validateMigratedConfig(migratedConfig, targetVersion)
      if (!validation.valid) {
        warnings.push(...validation.warnings)
        errors.push(...validation.errors)
      }
      
      const result: ConfigMigrationResult = {
        success: errors.length === 0,
        fromVersion: sourceVersion,
        toVersion: targetVersion,
        migratedCounts,
        warnings,
        errors
      }
      
      if (result.success) {
        appStore.addNotification({
          type: 'success',
          title: '配置迁移成功',
          message: `已成功从 ${sourceVersion} 迁移到 ${targetVersion}`,
          duration: 3000
        })
      } else {
        appStore.addNotification({
          type: 'error',
          title: '配置迁移失败',
          message: `迁移过程中发生 ${errors.length} 个错误`,
          duration: 5000
        })
      }
      
      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '迁移失败'
      setError(errorMessage)
      
      return {
        success: false,
        fromVersion: detectVersionFromStructure(config),
        toVersion: targetVersion,
        migratedCounts: {},
        warnings: [],
        errors: [errorMessage]
      }
    } finally {
      migrationInProgress.value = false
    }
  }

  // 高级冲突解决
  const resolveConfigConflicts = async (
    conflicts: ConfigConflict[],
    resolutions: ConfigConflictResolution[]
  ): Promise<any> => {
    const resolvedConfig: any = {}
    
    for (const conflict of conflicts) {
      const resolution = resolutions.find(r => r.conflictId === conflict.id)
      
      if (!resolution) {
        // 默认保留当前配置
        resolvedConfig[conflict.type] = conflict.current
        continue
      }
      
      switch (resolution.resolution) {
        case 'keep':
          resolvedConfig[conflict.type] = conflict.current
          break
        case 'replace':
          resolvedConfig[conflict.type] = conflict.incoming
          break
        case 'merge':
          resolvedConfig[conflict.type] = mergeConfigurations(
            conflict.current,
            conflict.incoming
          )
          break
        case 'custom':
          if (resolution.customValue !== undefined) {
            resolvedConfig[conflict.type] = resolution.customValue
          } else {
            resolvedConfig[conflict.type] = conflict.current
          }
          break
      }
    }
    
    return resolvedConfig
  }

  // 智能配置合并
  const mergeConfigurations = (current: any, incoming: any): any => {
    if (Array.isArray(current) && Array.isArray(incoming)) {
      // 数组合并：基于id或name去重
      const merged = [...current]
      
      for (const item of incoming) {
        const existingIndex = merged.findIndex(existing => 
          existing.id === item.id || existing.name === item.name
        )
        
        if (existingIndex >= 0) {
          // 合并对象属性
          merged[existingIndex] = { ...merged[existingIndex], ...item }
        } else {
          merged.push(item)
        }
      }
      
      return merged
    } else if (typeof current === 'object' && typeof incoming === 'object') {
      // 对象合并
      return { ...current, ...incoming }
    } else {
      // 基本类型：使用传入值
      return incoming
    }
  }

  // Helper functions for migration
  const detectVersionFromStructure = (config: any): string => {
    // 根据配置结构特征检测版本
    if (config.version) {
      return config.version
    }
    
    // 检查特定字段来推断版本
    if (config.servers && Array.isArray(config.servers)) {
      // 检查服务器配置结构
      const server = config.servers[0]
      if (server && server.mcpVersion) {
        return server.mcpVersion
      }
      if (server && server.apiVersion) {
        return '2.0.0' // 假设有apiVersion的是2.0版本
      }
    }
    
    if (config.auth && config.auth.oauth2) {
      return '2.1.0' // 有OAuth2支持的是2.1版本
    }
    
    return '1.0.0' // 默认版本
  }

  const getCompatibleVersions = (version: string): string[] => {
    const compatibilityMap: Record<string, string[]> = {
      '1.0.0': ['1.0.0', '1.1.0'],
      '1.1.0': ['1.0.0', '1.1.0', '1.2.0'],
      '1.2.0': ['1.1.0', '1.2.0', '2.0.0'],
      '2.0.0': ['1.2.0', '2.0.0', '2.1.0'],
      '2.1.0': ['2.0.0', '2.1.0']
    }
    return compatibilityMap[version] || [version]
  }

  const getVersionFeatures = (version: string): string[] => {
    const featureMap: Record<string, string[]> = {
      '1.0.0': ['基础服务器管理', '简单认证'],
      '1.1.0': ['批量操作', '配置模板'],
      '1.2.0': ['高级认证', '性能监控'],
      '2.0.0': ['新API架构', 'WebSocket支持'],
      '2.1.0': ['OAuth2支持', '高级冲突解决']
    }
    return featureMap[version] || []
  }

  const isVersionDeprecated = (version: string): boolean => {
    const deprecatedVersions = ['1.0.0']
    return deprecatedVersions.includes(version)
  }

  const needsMigration = (fromVersion: string, toVersion: string): boolean => {
    return fromVersion !== toVersion && 
           !getCompatibleVersions(fromVersion).includes(toVersion)
  }

  const getMigrationPath = (fromVersion: string, toVersion: string): string[] => {
    // 定义迁移路径
    const migrationPaths: Record<string, Record<string, string[]>> = {
      '1.0.0': {
        '1.1.0': ['1.0.0', '1.1.0'],
        '1.2.0': ['1.0.0', '1.1.0', '1.2.0'],
        '2.0.0': ['1.0.0', '1.1.0', '1.2.0', '2.0.0'],
        '2.1.0': ['1.0.0', '1.1.0', '1.2.0', '2.0.0', '2.1.0']
      },
      '1.1.0': {
        '1.2.0': ['1.1.0', '1.2.0'],
        '2.0.0': ['1.1.0', '1.2.0', '2.0.0'],
        '2.1.0': ['1.1.0', '1.2.0', '2.0.0', '2.1.0']
      }
      // 可以继续添加更多路径
    }
    
    return migrationPaths[fromVersion]?.[toVersion] || [fromVersion, toVersion]
  }

  const getMigrationDescription = (fromVersion: string, toVersion: string): string => {
    const descriptions: Record<string, string> = {
      '1.0.0_1.1.0': '添加批量操作支持和配置模板功能',
      '1.1.0_1.2.0': '升级认证系统，增加性能监控功能',
      '1.2.0_2.0.0': '重构API架构，添加WebSocket实时通信',
      '2.0.0_2.1.0': '集成OAuth2认证，增强冲突解决机制'
    }
    
    const key = `${fromVersion}_${toVersion}`
    return descriptions[key] || `从版本 ${fromVersion} 升级到 ${toVersion}`
  }

  const isMigrationRequired = (fromVersion: string, toVersion: string): boolean => {
    // 跨大版本的迁移通常是必需的
    const fromMajor = parseInt(fromVersion.split('.')[0])
    const toMajor = parseInt(toVersion.split('.')[0])
    
    return fromMajor !== toMajor
  }

  const executeMigrationStep = async (
    config: any,
    step: ConfigMigrationStep,
    resolutions: ConfigConflictResolution[]
  ): Promise<{ success: boolean; message: string; data?: any }> => {
    try {
      const { fromVersion, toVersion } = step
      let migratedConfig = { ...config }
      
      // 根据版本执行具体的迁移逻辑
      if (fromVersion === '1.0.0' && toVersion === '1.1.0') {
        // 1.0.0 -> 1.1.0: 添加批量操作配置
        migratedConfig.batchOperations = {
          enabled: true,
          maxConcurrent: 5
        }
        
        // 更新服务器配置格式
        if (migratedConfig.servers) {
          migratedConfig.servers = migratedConfig.servers.map((server: any) => ({
            ...server,
            batchSupport: true
          }))
        }
      } else if (fromVersion === '1.1.0' && toVersion === '1.2.0') {
        // 1.1.0 -> 1.2.0: 升级认证配置
        if (migratedConfig.auth) {
          migratedConfig.auth = {
            ...migratedConfig.auth,
            advanced: {
              tokenRefresh: true,
              multiProvider: false
            }
          }
        }
      } else if (fromVersion === '1.2.0' && toVersion === '2.0.0') {
        // 1.2.0 -> 2.0.0: 重构API配置
        migratedConfig.apiVersion = '2.0'
        migratedConfig.websocket = {
          enabled: true,
          port: 3001
        }
        
        // 重构服务器配置
        if (migratedConfig.servers) {
          migratedConfig.servers = migratedConfig.servers.map((server: any) => ({
            id: server.id || `server_${Date.now()}`,
            name: server.name,
            config: {
              host: server.host || 'localhost',
              port: server.port || 3000,
              protocol: server.protocol || 'http'
            },
            status: server.status || 'stopped',
            version: '2.0.0'
          }))
        }
      } else if (fromVersion === '2.0.0' && toVersion === '2.1.0') {
        // 2.0.0 -> 2.1.0: 添加OAuth2支持
        if (migratedConfig.auth) {
          migratedConfig.auth.oauth2 = {
            enabled: false,
            providers: []
          }
        }
        
        migratedConfig.conflictResolution = {
          strategy: 'interactive',
          autoMerge: false
        }
      }
      
      // 更新版本信息
      migratedConfig.version = toVersion
      migratedConfig.migratedAt = new Date().toISOString()
      
      return {
        success: true,
        message: `成功迁移到版本 ${toVersion}`,
        data: migratedConfig
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : '迁移步骤执行失败'
      }
    }
  }

  const validateMigratedConfig = async (
    config: any,
    version: string
  ): Promise<{ valid: boolean; warnings: string[]; errors: string[] }> => {
    const warnings: string[] = []
    const errors: string[] = []
    
    // 验证基本结构
    if (!config.version) {
      errors.push('配置缺少版本信息')
    }
    
    if (config.version !== version) {
      warnings.push(`配置版本 ${config.version} 与目标版本 ${version} 不匹配`)
    }
    
    // 根据版本验证特定字段
    if (version >= '2.0.0') {
      if (!config.apiVersion) {
        warnings.push('2.0版本建议包含apiVersion字段')
      }
      
      if (!config.websocket) {
        warnings.push('2.0版本建议配置WebSocket支持')
      }
    }
    
    if (version >= '2.1.0') {
      if (!config.auth?.oauth2) {
        warnings.push('2.1版本建议配置OAuth2认证')
      }
    }
    
    // 验证服务器配置
    if (config.servers && Array.isArray(config.servers)) {
      config.servers.forEach((server: any, index: number) => {
        if (!server.id) {
          errors.push(`服务器配置 ${index} 缺少ID字段`)
        }
        if (!server.name) {
          errors.push(`服务器配置 ${index} 缺少名称字段`)
        }
      })
    }
    
    return {
      valid: errors.length === 0,
      warnings,
      errors
    }
  }

  // 删除配置备份
  const deleteBackup = async (backupId: string): Promise<boolean> => {
    try {
      const index = backups.value.findIndex(b => b.id === backupId)
      if (index === -1) {
        throw new Error('备份不存在')
      }
      
      backups.value.splice(index, 1)
      
      appStore.addNotification({
        type: 'success',
        title: '备份删除成功',
        message: '配置备份已删除',
        duration: 3000
      })
      
      return true
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '删除失败'
      setError(errorMessage)
      return false
    }
  }
  const getConfigData = async (type: string): Promise<any> => {
    // 模拟获取不同类型的配置数据
    const mockData: Record<string, any> = {
      servers: [
        { id: '1', name: 'API Server', port: 3000, status: 'running' },
        { id: '2', name: 'Test Server', port: 3001, status: 'stopped' }
      ],
      auth: [
        { id: '1', type: 'bearer', name: 'API Token' },
        { id: '2', type: 'basic', name: 'Basic Auth' }
      ],
      openapi: [
        { id: '1', name: 'User API', version: '1.0.0' },
        { id: '2', name: 'Product API', version: '2.0.0' }
      ],
      testcases: [
        { id: '1', name: 'Login Test', type: 'auth' },
        { id: '2', name: 'CRUD Test', type: 'api' }
      ],
      settings: {
        theme: 'light',
        language: 'zh-CN',
        notifications: true
      }
    }
    
    return mockData[type] || []
  }

  const getConfigTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      servers: '服务器配置',
      auth: '认证配置',
      openapi: 'OpenAPI规范',
      testcases: '测试用例',
      settings: '系统设置'
    }
    return labels[type] || type
  }

  const removeSensitiveData = (data: any): void => {
    const sensitiveKeys = ['password', 'token', 'secret', 'key', 'apiKey', 'clientSecret']
    
    const removeSensitive = (obj: any): void => {
      if (typeof obj === 'object' && obj !== null) {
        for (const key in obj) {
          if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
            obj[key] = '[REMOVED]'
          } else if (typeof obj[key] === 'object') {
            removeSensitive(obj[key])
          }
        }
      }
    }
    
    removeSensitive(data)
  }

  const encryptSensitiveData = (data: any, password: string): void => {
    const encrypt = (text: string): string => {
      // 简单的加密实现（实际项目中应使用更安全的加密方法）
      return btoa(text + password)
    }
    
    const sensitiveKeys = ['password', 'token', 'secret', 'key', 'apiKey', 'clientSecret']
    
    const encryptSensitive = (obj: any): void => {
      if (typeof obj === 'object' && obj !== null) {
        for (const key in obj) {
          if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
            if (typeof obj[key] === 'string') {
              obj[key] = `[ENCRYPTED]${encrypt(obj[key])}`
            }
          } else if (typeof obj[key] === 'object') {
            encryptSensitive(obj[key])
          }
        }
      }
    }
    
    encryptSensitive(data)
  }

  const generateFilename = (format: string): string => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const extensions: Record<string, string> = {
      json: 'json',
      yaml: 'yaml',
      zip: 'zip'
    }
    return `mcp-config-${timestamp}.${extensions[format] || 'json'}`
  }

  const formatContent = (data: any, format: string): string => {
    switch (format) {
      case 'yaml':
        // 简单的YAML转换（实际项目中应使用专门的库）
        return JSON.stringify(data, null, 2)
          .replace(/"/g, '')
          .replace(/,$/gm, '')
      case 'zip':
        // ZIP格式处理（实际项目中应使用JSZip等库）
        return JSON.stringify(data, null, 2)
      default:
        return JSON.stringify(data, null, 2)
    }
  }

  const getMimeType = (format: string): string => {
    const mimeTypes: Record<string, string> = {
      json: 'application/json',
      yaml: 'application/x-yaml',
      zip: 'application/zip'
    }
    return mimeTypes[format] || 'application/json'
  }

  const downloadFile = (content: string, filename: string, mimeType: string): void => {
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const readFileContent = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => resolve(e.target?.result as string)
      reader.onerror = () => reject(new Error('文件读取失败'))
      reader.readAsText(file)
    })
  }

  const parseConfigFile = (content: string, filename: string): any => {
    const ext = filename.split('.').pop()?.toLowerCase()
    
    if (ext === 'json') {
      return JSON.parse(content)
    } else if (ext === 'yaml' || ext === 'yml') {
      // 实际项目中应使用yaml解析库
      return JSON.parse(content) // 临时实现
    } else {
      throw new Error('不支持的文件格式')
    }
  }

  const validateConfigStructure = async (config: any): Promise<ConfigValidationResult> => {
    const errors: Array<{ id: string; message: string; details: string }> = []
    const warnings: Array<{ id: string; message: string; details: string }> = []
    const configCounts: Record<string, number> = {}
    
    // 验证配置结构
    const validTypes = ['servers', 'auth', 'openapi', 'testcases', 'settings']
    
    for (const [type, data] of Object.entries(config)) {
      if (!validTypes.includes(type)) {
        warnings.push({
          id: `unknown_type_${type}`,
          message: `未知的配置类型: ${type}`,
          details: '此配置类型可能不被支持'
        })
        continue
      }
      
      if (Array.isArray(data)) {
        configCounts[type] = data.length
        
        // 验证数组中的每个配置项
        for (const item of data) {
          if (!item.id && !item.name) {
            errors.push({
              id: `missing_identifier_${type}`,
              message: `${getConfigTypeLabel(type)} 缺少标识符`,
              details: '配置项必须包含 id 或 name 字段'
            })
          }
        }
      } else if (typeof data === 'object') {
        configCounts[type] = 1
      } else {
        errors.push({
          id: `invalid_structure_${type}`,
          message: `${getConfigTypeLabel(type)} 配置结构无效`,
          details: '配置数据必须是对象或数组'
        })
      }
    }
    
    return {
      valid: errors.length === 0,
      configCounts,
      errors,
      warnings
    }
  }

  const findExistingConfig = async (type: string, config: any): Promise<any> => {
    // 模拟查找现有配置
    const existing = await getConfigData(type)
    
    if (Array.isArray(existing)) {
      return existing.find(item => 
        item.id === config.id || 
        item.name === config.name
      )
    }
    
    return null
  }

  const resolveConflicts = (config: any, conflicts: ConfigConflict[]): any => {
    const resolved = { ...config }
    
    for (const conflict of conflicts) {
      const [type, identifier] = conflict.id.split('_', 2)
      
      if (resolved[type] && Array.isArray(resolved[type])) {
        const index = resolved[type].findIndex((item: any) => 
          item.id === identifier || item.name === identifier
        )
        
        if (index !== -1) {
          switch (conflict.resolution) {
            case 'keep':
              // 保留现有配置，删除导入的配置
              resolved[type].splice(index, 1)
              break
            case 'replace':
              // 使用导入的配置替换现有配置
              resolved[type][index] = conflict.incoming
              break
            case 'merge':
              // 合并配置
              resolved[type][index] = { ...conflict.current, ...conflict.incoming }
              break
          }
        }
      }
    }
    
    return resolved
  }

  const applyConfigType = async (type: string, configs: any): Promise<number> => {
    // 模拟应用配置
    await new Promise(resolve => setTimeout(resolve, 500))
    
    if (Array.isArray(configs)) {
      return configs.length
    } else if (typeof configs === 'object') {
      return 1
    }
    
    return 0
  }

  // Computed
  const backupList = computed(() => {
    return backups.value.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
  })

  const exportHistoryList = computed(() => {
    return exportHistory.value.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
  })

  return {
    // State
    loading,
    error,
    backups,
    exportHistory,
    migrationInProgress,
    currentVersion,
    availableVersions,
    migrationSteps,
    conflictResolutions,
    
    // Computed
    backupList,
    exportHistoryList,
    
    // Actions
    setLoading,
    setError,
    clearError,
    exportConfig,
    validateImportConfig,
    detectConflicts,
    applyImportConfig,
    createBackup,
    restoreBackup,
    deleteBackup,
    
    // Migration and conflict resolution
    detectConfigVersion,
    createMigrationPlan,
    migrateConfig,
    resolveConfigConflicts,
    mergeConfigurations
  }
})
