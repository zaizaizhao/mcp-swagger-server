import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { OpenAPISpec, ValidationResult, MCPTool, ParsedOpenAPISpec, MCPConfig } from '@/types'
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
  const currentParsedResult = ref<ParsedOpenAPISpec | null>(null)
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
      specs.value = response
      clearError()
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
      specs.value.push(response)
      appStore.addNotification({
        type: 'success',
        title: '规范创建成功',
        message: `OpenAPI规范 "${config.name}" 已创建`,
        duration: 3000
      })
      clearError()
      return response
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
      specs.value.push(response)
      appStore.addNotification({
        type: 'success',
        title: '规范上传成功',
        message: `OpenAPI规范 "${config.name}" 已上传`,
        duration: 3000
      })
      clearError()
      return response
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
      specs.value.push(response)
      appStore.addNotification({
        type: 'success',
        title: '规范导入成功',
        message: `OpenAPI规范 "${config.name}" 已从URL导入`,
        duration: 3000
      })
      clearError()
      return response
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
      const index = specs.value.findIndex(s => s.id === id)
      if (index > -1) {
        specs.value[index] = response
      }
      appStore.addNotification({
        type: 'success',
        title: '规范保存成功',
        message: '规范内容已更新',
        duration: 3000
      })
      clearError()
      return true
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
    setLoading(true)
    try {
      const response = await openApiAPI.getSpecContent(id)
      clearError()
      return response
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '获取规范内容失败'
      setError(errorMessage)
      console.error('Failed to get spec content:', err)
      throw err
    } finally {
      setLoading(false)
    }
  }

  // 复制规范
  const duplicateSpec = async (id: string): Promise<OpenAPISpec> => {
    setLoading(true)
    try {
      const response = await openApiAPI.duplicateSpec(id)
      specs.value.push(response)
      appStore.addNotification({
        type: 'success',
        title: '规范复制成功',
        message: `规范 "${response.name}" 已成功复制`,
        duration: 3000
      })
      clearError()
      return response
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
  const validateSpec = async (id: string): Promise<ValidationResult> => {
    setLoading(true)
    try {
      const response = await openApiAPI.validateSpec(id)
      clearError()
      return response
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '验证规范失败'
      setError(errorMessage)
      console.error('Failed to validate spec:', err)
      throw err
    } finally {
      setLoading(false)
    }
  }

  // 转换为MCP配置
  const convertToMCP = async (id: string): Promise<MCPTool[]> => {
    setLoading(true)
    try {
      const response = await openApiAPI.convertToMCP(id)
      appStore.addNotification({
        type: 'success',
        title: 'MCP转换成功',
        message: '规范已成功转换为MCP配置',
        duration: 3000
      })
      clearError()
      return response
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'MCP转换失败'
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

  // 验证OpenAPI内容
  const validateOpenAPIContent = async (content: string): Promise<ValidationResult> => {
    setLoading(true)
    try {
      const response = await openApiAPI.validateOpenAPIContent(content)
      clearError()
      return response
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '验证OpenAPI内容失败'
      setError(errorMessage)
      console.error('Failed to validate OpenAPI content:', err)
      throw err
    } finally {
      setLoading(false)
    }
  }

  // 解析OpenAPI内容
  const parseOpenAPIContent = async (content: string): Promise<ParsedOpenAPISpec> => {
    setLoading(true)
    try {
      const response = await openApiAPI.parseOpenAPIContent(content)
      currentParsedResult.value = response
      clearError()
      return response
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '解析OpenAPI内容失败'
      setError(errorMessage)
      console.error('Failed to parse OpenAPI content:', err)
      throw err
    } finally {
      setLoading(false)
    }
  }

  // 从URL解析OpenAPI
  const parseOpenAPIFromUrl = async (url: string): Promise<ParsedOpenAPISpec> => {
    setLoading(true)
    try {
      const response = await openApiAPI.parseOpenAPIFromUrl(url)
      currentParsedResult.value = response
      clearError()
      return response
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '从URL解析OpenAPI失败'
      setError(errorMessage)
      console.error('Failed to parse OpenAPI from URL:', err)
      throw err
    } finally {
      setLoading(false)
    }
  }

  // 新增：上传并解析 OpenAPI 文件
  const uploadAndParseSpec = async (file: File) => {
    parsing.value = true
    try {
      const response = await openApiAPI.uploadAndParseSpec(file)
      currentParsedResult.value = response
      appStore.addNotification({
        type: 'success',
        title: '文件解析成功',
        message: `成功解析 ${response.endpoints?.length || 0} 个接口`,
        duration: 3000
      })
      clearError()
      return response
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
    setLoading(true)
    try {
      const response = await openApiAPI.uploadAndValidateSpec(file)
      clearError()
      return response
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '文件验证失败'
      setError(errorMessage)
      console.error('Failed to upload and validate spec:', err)
      throw err
    } finally {
      setLoading(false)
    }
  }

  // 新增：从URL验证 OpenAPI 规范
  const validateSpecFromUrl = async (url: string): Promise<ValidationResult> => {
    setLoading(true)
    try {
      const response = await openApiAPI.validateSpecFromUrl(url)
      clearError()
      return response
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'URL验证失败'
      setError(errorMessage)
      console.error('Failed to validate spec from URL:', err)
      throw err
    } finally {
      setLoading(false)
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
