import { defineStore } from 'pinia'
import type { 
  AppState, 
  InputSource, 
  ConvertConfig, 
  OpenApiInfo, 
  ApiEndpoint, 
  ConvertResult 
} from '@/types'
import { convertApi, validateApi, previewApi } from '@/utils/api'
import { getAvailableTags, getParserStats } from '@/utils/parser'

export const useAppStore = defineStore('app', {
  state: (): AppState => ({
    inputSource: {
      type: 'url',
      content: 'https://petstore.swagger.io/v2/swagger.json'
    },
    config: {
      filters: {
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        tags: [],
        includeDeprecated: false
      },
      transport: 'stdio',
      optimization: {
        generateValidation: true,
        includeExamples: false,
        optimizeNames: true
      }
    },
    apiInfo: null,
    endpoints: [],
    convertResult: null,
    loading: false,
    error: null
  }),

  getters: {
    isValidInput: (state) => {
      return state.inputSource.content.trim().length > 0
    },
    
    availableTags: (state) => {
      const tags = new Set<string>()
      state.endpoints.forEach(endpoint => {
        endpoint.tags?.forEach(tag => tags.add(tag))
      })
      return Array.from(tags)
    },
    
    filteredEndpoints: (state) => {
      return state.endpoints.filter(endpoint => {
        // 方法过滤
        if (!state.config.filters.methods.includes(endpoint.method.toUpperCase())) {
          return false
        }
        
        // 标签过滤
        if (state.config.filters.tags.length > 0) {
          const hasMatchingTag = endpoint.tags?.some(tag => 
            state.config.filters.tags.includes(tag)
          )
          if (!hasMatchingTag) return false
        }
        
        // 是否包含已弃用的端点
        if (!state.config.filters.includeDeprecated && endpoint.deprecated) {
          return false
        }
        
        return true
      })
    }
  },

  actions: {
    setInputSource(source: Partial<InputSource>) {
      this.inputSource = { ...this.inputSource, ...source }
      this.clearResults()
    },

    setConfig(config: Partial<ConvertConfig>) {
      this.config = { ...this.config, ...config }
    },

    clearResults() {
      this.apiInfo = null
      this.endpoints = []
      this.convertResult = null
      this.error = null
    },

    async validateInput() {
      if (!this.isValidInput) {
        throw new Error('请提供有效的输入内容')
      }

      this.loading = true
      this.error = null

      try {
        const result = await validateApi(this.inputSource)
        if (result.success) {
          return true
        } else {
          this.error = result.error || '验证失败'
          return false
        }
      } catch (error) {
        this.error = error instanceof Error ? error.message : '验证失败'
        return false
      } finally {
        this.loading = false
      }
    },

    async previewApi() {
      if (!this.isValidInput) {
        throw new Error('请提供有效的输入内容')
      }

      this.loading = true
      this.error = null

      try {
        const result = await previewApi(this.inputSource)
        if (result.success && result.data) {
          this.apiInfo = result.data.apiInfo
          this.endpoints = result.data.endpoints || []
        } else {
          this.error = result.error || '预览失败'
        }
      } catch (error) {
        this.error = error instanceof Error ? error.message : '预览失败'
      } finally {
        this.loading = false
      }
    },

    async convertToMcp() {
      if (!this.isValidInput) {
        throw new Error('请提供有效的输入内容')
      }

      this.loading = true
      this.error = null

      try {
        const result = await convertApi({
          source: this.inputSource,
          config: this.config
        })
        
        if (result.success && result.data) {
          this.convertResult = result.data
          // 如果还没有预览数据，更新预览信息
          if (!this.apiInfo && result.data.metadata) {
            this.apiInfo = result.data.metadata.apiInfo
          }
        } else {
          this.error = result.error || '转换失败'
        }
      } catch (error) {
        this.error = error instanceof Error ? error.message : '转换失败'
      } finally {
        this.loading = false
      }    },

    async getParserStatistics() {
      if (!this.isValidInput) {
        return null
      }

      try {
        return await getParserStats(this.inputSource)
      } catch (error) {
        console.error('获取解析器统计信息失败:', error)
        return null
      }
    },

    async refreshAvailableTags() {
      if (!this.isValidInput) {
        return
      }

      try {
        const tags = await getAvailableTags(this.inputSource)
        // 这里可以更新可用标签列表，如果需要的话
        return tags
      } catch (error) {
        console.error('获取可用标签失败:', error)
        return []
      }
    }
  }
})
