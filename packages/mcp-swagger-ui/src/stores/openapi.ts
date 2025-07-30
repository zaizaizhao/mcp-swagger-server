import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { OpenAPISpec, ValidationResult, MCPTool } from '@/types'
import { openApiAPI } from '@/services/api'
import { useAppStore } from './app'
import { convertOpenAPIToMCPTools } from '@/utils/openapi'

export const useOpenAPIStore = defineStore('openapi', () => {
  const appStore = useAppStore()

  // 状态
  const specs = ref<OpenAPISpec[]>([])
  const selectedSpecId = ref<string | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  
  // 新增：解析结果状态
  const currentParsedResult = ref<{
    info: any;
    paths: Record<string, any>;
    endpoints: any[];
    tools: any[];
    servers: any[];
    openapi: string;
    components: any;
    parsedAt: string;
    parseId?: string;
  } | null>(null)
  const parsing = ref(false)

  // 计算属性
  const selectedSpec = computed(() => 
    specs.value.find(s => s.id === selectedSpecId.value) || null
  )

  const validSpecs = computed(() => 
    specs.value.filter(s => s.validationStatus === 'valid')
  )

  const invalidSpecs = computed(() => 
    specs.value.filter(s => s.validationStatus === 'invalid')
  )

  const totalSpecs = computed(() => specs.value.length)

  // Actions
  const setLoading = (value: boolean) => {
    loading.value = value
  }

  const setError = (errorMessage: string | null) => {
    error.value = errorMessage
    if (errorMessage) {
      appStore.addNotification({
        type: 'error',
        title: '操作失败',
        message: errorMessage,
        duration: 5000
      })
    }
  }

  const clearError = () => {
    error.value = null
  }

  // 获取所有规范
  const fetchSpecs = async (): Promise<void> => {
    setLoading(true)
    try {
      const response = await openApiAPI.getSpecs()
      if (response.success && response.data) {
        specs.value = response.data
        clearError()
      } else {
        throw new Error(response.error || '获取规范列表失败')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '获取规范列表失败'
      setError(errorMessage)
      console.error('Failed to fetch specs:', err)
    } finally {
      setLoading(false)
    }
  }

  // 创建新规范
  const createSpec = async (config: {
    name: string
    version: string
    description?: string
    template?: string
  }): Promise<OpenAPISpec> => {
    setLoading(true)
    try {
      const response = await openApiAPI.createSpec(config)
      if (response.success && response.data) {
        specs.value.push(response.data)
        appStore.addNotification({
          type: 'success',
          title: '规范创建成功',
          message: `OpenAPI规范 "${config.name}" 已创建`,
          duration: 3000
        })
        clearError()
        return response.data
      } else {
        throw new Error(response.error || '创建规范失败')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '创建规范失败'
      setError(errorMessage)
      console.error('Failed to create spec:', err)
      throw err
    } finally {
      setLoading(false)
    }
  }

  // 从内容创建规范
  const createSpecFromContent = async (config: {
    name: string
    content: string
    fileName?: string
  }): Promise<OpenAPISpec> => {
    setLoading(true)
    try {
      const response = await openApiAPI.createSpecFromContent(config)
      if (response.success && response.data) {
        specs.value.push(response.data)
        appStore.addNotification({
          type: 'success',
          title: '规范上传成功',
          message: `OpenAPI规范 "${config.name}" 已上传`,
          duration: 3000
        })
        clearError()
        return response.data
      } else {
        throw new Error(response.error || '上传规范失败')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '上传规范失败'
      setError(errorMessage)
      console.error('Failed to create spec from content:', err)
      throw err
    } finally {
      setLoading(false)
    }
  }

  // 从URL导入规范
  const importFromUrl = async (config: {
    url: string
    name: string
    authType: 'none' | 'bearer' | 'basic'
    token?: string
    username?: string
    password?: string
  }): Promise<OpenAPISpec> => {
    setLoading(true)
    try {
      const response = await openApiAPI.importFromUrl(config)
      if (response.success && response.data) {
        specs.value.push(response.data)
        appStore.addNotification({
          type: 'success',
          title: '规范导入成功',
          message: `OpenAPI规范 "${config.name}" 已从URL导入`,
          duration: 3000
        })
        clearError()
        return response.data
      } else {
        throw new Error(response.error || '导入规范失败')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '导入规范失败'
      setError(errorMessage)
      console.error('Failed to import spec from URL:', err)
      throw err
    } finally {
      setLoading(false)
    }
  }

  // 更新规范内容
  const updateSpecContent = async (id: string, content: string): Promise<boolean> => {
    setLoading(true)
    try {
      const response = await openApiAPI.updateSpecContent(id, content)
      if (response.success && response.data) {
        const index = specs.value.findIndex(s => s.id === id)
        if (index > -1) {
          specs.value[index] = response.data
        }
        appStore.addNotification({
          type: 'success',
          title: '规范保存成功',
          message: '规范内容已更新',
          duration: 3000
        })
        clearError()
        return true
      } else {
        throw new Error(response.error || '更新规范失败')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '更新规范失败'
      setError(errorMessage)
      console.error('Failed to update spec content:', err)
      return false
    } finally {
      setLoading(false)
    }
  }

  // 获取规范内容
  const getSpecContent = async (id: string): Promise<string> => {
    try {
      const response = await openApiAPI.getSpecContent(id)
      if (response.success && response.data) {
        return response.data
      } else {
        throw new Error(response.error || '获取规范内容失败')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '获取规范内容失败'
      setError(errorMessage)
      console.error('Failed to get spec content:', err)
      throw err
    }
  }

  // 复制规范
  const duplicateSpec = async (id: string): Promise<OpenAPISpec> => {
    setLoading(true)
    try {
      const response = await openApiAPI.duplicateSpec(id)
      if (response.success && response.data) {
        specs.value.push(response.data)
        appStore.addNotification({
          type: 'success',
          title: '规范复制成功',
          message: `规范已复制为 "${response.data.name}"`,
          duration: 3000
        })
        clearError()
        return response.data
      } else {
        throw new Error(response.error || '复制规范失败')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '复制规范失败'
      setError(errorMessage)
      console.error('Failed to duplicate spec:', err)
      throw err
    } finally {
      setLoading(false)
    }
  }

  // 删除规范
  const deleteSpec = async (id: string): Promise<boolean> => {
    setLoading(true)
    try {
      const response = await openApiAPI.deleteSpec(id)
      if (response.success) {
        const index = specs.value.findIndex(s => s.id === id)
        if (index > -1) {
          const specName = specs.value[index].name
          specs.value.splice(index, 1)
          
          // 如果删除的是当前选中的规范，清除选择
          if (selectedSpecId.value === id) {
            selectedSpecId.value = null
          }
          
          appStore.addNotification({
            type: 'success',
            title: '规范删除成功',
            message: `规范 "${specName}" 已删除`,
            duration: 3000
          })
        }
        clearError()
        return true
      } else {
        throw new Error(response.error || '删除规范失败')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '删除规范失败'
      setError(errorMessage)
      console.error('Failed to delete spec:', err)
      return false
    } finally {
      setLoading(false)
    }
  }

  // 验证规范
  const validateSpec = async (content: string): Promise<ValidationResult> => {
    try {
      const result = await openApiAPI.validateSpec(content);
      console.log(result);
      
      // 确保返回符合ValidationResult接口的数据
      if (result.success && result.data) {
        return {
          valid: result.data.valid,
          errors: result.data.errors || [],
          warnings: result.data.warnings || []
        };
      } else {
        return {
          valid: false,
          errors: [{
            path: '',
            message: result.error || '验证失败',
            severity: 'error',
            code: 'VALIDATION_ERROR'
          }],
          warnings: []
        };
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '验证规范失败'
      setError(errorMessage)
      console.error('Failed to validate spec:', err)
      throw err
    }
  }

  // 转换为MCP工具
  const convertToMCP = async (spec: OpenAPISpec): Promise<MCPTool[]> => {
    setLoading(true)
    try {
      // 首先尝试使用本地转换函数
      const localTools = convertOpenAPIToMCPTools(spec.content || JSON.stringify(spec))
      
      if (localTools.length > 0) {
        appStore.addNotification({
          type: 'success',
          title: '转换成功',
          message: `成功转换为 ${localTools.length} 个MCP工具`,
          duration: 3000
        })
        clearError()
        return localTools
      }
      
      // 如果本地转换失败，尝试使用API
      const response = await openApiAPI.convertToMCP(spec)
      if (response.success && response.data) {
        appStore.addNotification({
          type: 'success',
          title: '转换成功',
          message: `成功转换为 ${response.data.length} 个MCP工具`,
          duration: 3000
        })
        clearError()
        return response.data
      } else {
        throw new Error(response.error || '转换失败')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '转换失败'
      setError(errorMessage)
      console.error('Failed to convert to MCP:', err)
      throw err
    } finally {
      setLoading(false)
    }
  }

  // 选择规范
  const selectSpec = (id: string | null) => {
    selectedSpecId.value = id
  }

  // 新增：解析 OpenAPI 内容
  const parseOpenAPIContent = async (content: string) => {
    parsing.value = true
    try {
      const response = await openApiAPI.parseOpenAPIContent(content)
      if (response.success && response.data) {
        currentParsedResult.value = response.data
        appStore.addNotification({
          type: 'success',
          title: '解析成功',
          message: `成功解析 ${response.data.endpoints?.length || 0} 个接口`,
          duration: 3000
        })
        clearError()
        return response.data
      } else {
        throw new Error(response.error || '解析失败')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '解析失败'
      setError(errorMessage)
      console.error('Failed to parse OpenAPI content:', err)
      throw err
    } finally {
      parsing.value = false
    }
  }

  // 新增：从 URL 解析 OpenAPI
  const parseOpenAPIFromUrl = async (url: string, authHeaders?: Record<string, string>) => {
    parsing.value = true
    try {
      const response = await openApiAPI.parseSpecFromUrl(url)
      if (response.success && response.data) {
        currentParsedResult.value = response.data
        appStore.addNotification({
          type: 'success',
          title: '解析成功',
          message: `成功解析 ${response.data.endpoints?.length || 0} 个接口`,
          duration: 3000
        })
        clearError()
        return response.data
      } else {
        throw new Error(response.error || '解析失败')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '解析失败'
      setError(errorMessage)
      console.error('Failed to parse OpenAPI from URL:', err)
      throw err
    } finally {
      parsing.value = false
    }
  }

  // 新增：上传并解析 OpenAPI 文件
  const uploadAndParseSpec = async (file: File) => {
    parsing.value = true
    try {
      const response = await openApiAPI.uploadAndParseSpec(file)
      if (response.success && response.data) {
        currentParsedResult.value = response.data
        appStore.addNotification({
          type: 'success',
          title: '文件解析成功',
          message: `成功解析 ${response.data.endpoints?.length || 0} 个接口`,
          duration: 3000
        })
        clearError()
        return response.data
      } else {
        throw new Error(response.error || '文件解析失败')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '文件解析失败'
      setError(errorMessage)
      console.error('Failed to upload and parse spec:', err)
      throw err
    } finally {
      parsing.value = false
    }
  }

  // 新增：上传并验证 OpenAPI 文件
  const uploadAndValidateSpec = async (file: File): Promise<ValidationResult> => {
    try {
      const response = await openApiAPI.uploadAndValidateSpec(file)
      if (response.success && response.data) {
        return {
          valid: response.data.valid,
          errors: response.data.errors.map(error => ({
            path: '',
            message: error,
            severity: 'error' as const,
            code: 'VALIDATION_ERROR'
          })),
          warnings: response.data.warnings.map(warning => ({
            path: '',
            message: warning,
            severity: 'warning' as const,
            code: 'VALIDATION_WARNING'
          }))
        }
      } else {
        return {
          valid: false,
          errors: [{
            path: '',
            message: response.error || '文件验证失败',
            severity: 'error',
            code: 'VALIDATION_ERROR'
          }],
          warnings: []
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '文件验证失败'
      setError(errorMessage)
      console.error('Failed to upload and validate spec:', err)
      throw err
    }
  }

  // 新增：从URL验证 OpenAPI 规范
  const validateSpecFromUrl = async (url: string): Promise<ValidationResult> => {
    try {
      const response = await openApiAPI.validateSpecFromUrl(url)
      if (response.success && response.data) {
        return {
          valid: response.data.valid,
          errors: response.data.errors.map(error => ({
            path: '',
            message: error,
            severity: 'error' as const,
            code: 'VALIDATION_ERROR'
          })),
          warnings: response.data.warnings.map(warning => ({
            path: '',
            message: warning,
            severity: 'warning' as const,
            code: 'VALIDATION_WARNING'
          }))
        }
      } else {
        return {
          valid: false,
          errors: [{
            path: '',
            message: response.error || 'URL验证失败',
            severity: 'error',
            code: 'VALIDATION_ERROR'
          }],
          warnings: []
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'URL验证失败'
      setError(errorMessage)
      console.error('Failed to validate spec from URL:', err)
      throw err
    }
  }

  // 新增：设置当前解析结果
  const setCurrentParsedResult = (result: any) => {
    currentParsedResult.value = result
  }

  // 新增：清除解析结果
  const clearParsedResult = () => {
    currentParsedResult.value = null
  }

  // 初始化
  const initialize = async () => {
    await fetchSpecs()
  }

  return {
    // 状态
    specs,
    selectedSpecId,
    loading,
    error,
    currentParsedResult,
    parsing,
    
    // 计算属性
    selectedSpec,
    validSpecs,
    invalidSpecs,
    totalSpecs,
    
    // Actions
    setLoading,
    setError,
    clearError,
    fetchSpecs,
    createSpec,
    createSpecFromContent,
    importFromUrl,
    updateSpecContent,
    getSpecContent,
    duplicateSpec,
    deleteSpec,
    validateSpec,
    convertToMCP,
    selectSpec,
    initialize,
    
    // 新增：解析相关方法
    parseOpenAPIContent,
    parseOpenAPIFromUrl,
    uploadAndParseSpec,
    uploadAndValidateSpec,
    validateSpecFromUrl,
    setCurrentParsedResult,
    clearParsedResult
  }
})
