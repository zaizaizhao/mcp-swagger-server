import { ref, computed, watch, readonly, type Ref } from 'vue'
import { ElMessage } from 'element-plus'

// 验证规则类型
export interface ValidationRule {
  required?: boolean
  type?: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'email' | 'url' | 'date'
  min?: number
  max?: number
  pattern?: RegExp
  validator?: (value: any) => boolean | string | Promise<boolean | string>
  message?: string
  trigger?: 'blur' | 'change' | 'input'
  asyncValidator?: (value: any) => Promise<boolean | string>
}

// 字段配置
export interface FieldConfig {
  name: string
  label: string
  rules: ValidationRule[]
  initialValue?: any
  dependencies?: string[]
}

// 验证结果
export interface ValidationResult {
  valid: boolean
  message?: string
  field: string
}

// 表单状态
export interface FormState {
  values: Record<string, any>
  errors: Record<string, string>
  touched: Record<string, boolean>
  validating: Record<string, boolean>
  isValid: boolean
  isDirty: boolean
  isSubmitting: boolean
}

// 表单验证Composable
export function useFormValidation(fields: FieldConfig[]) {
  // 表单状态
  const formState = ref<FormState>({
    values: {},
    errors: {},
    touched: {},
    validating: {},
    isValid: false,
    isDirty: false,
    isSubmitting: false
  })

  // 验证中的字段
  const validatingFields = ref<Set<string>>(new Set())

  // 初始化表单值
  const initializeForm = () => {
    const initialValues: Record<string, any> = {}
    fields.forEach(field => {
      initialValues[field.name] = field.initialValue ?? getDefaultValue(field.rules)
    })
    
    formState.value.values = { ...initialValues }
    formState.value.errors = {}
    formState.value.touched = {}
    formState.value.validating = {}
    formState.value.isValid = false
    formState.value.isDirty = false
    formState.value.isSubmitting = false
  }

  // 获取默认值
  const getDefaultValue = (rules: ValidationRule[]) => {
    const typeRule = rules.find(rule => rule.type)
    if (typeRule) {
      switch (typeRule.type) {
        case 'number': return 0
        case 'boolean': return false
        case 'array': return []
        case 'object': return {}
        default: return ''
      }
    }
    return ''
  }

  // 验证单个字段
  const validateField = async (fieldName: string, value: any): Promise<ValidationResult> => {
    const field = fields.find(f => f.name === fieldName)
    if (!field) {
      return { valid: true, field: fieldName }
    }

    // 设置验证状态
    formState.value.validating[fieldName] = true
    validatingFields.value.add(fieldName)

    try {
      for (const rule of field.rules) {
        const result = await validateRule(rule, value, fieldName)
        if (!result.valid) {
          formState.value.errors[fieldName] = result.message || '验证失败'
          formState.value.validating[fieldName] = false
          validatingFields.value.delete(fieldName)
          return result
        }
      }

      // 验证通过
      delete formState.value.errors[fieldName]
      formState.value.validating[fieldName] = false
      validatingFields.value.delete(fieldName)
      
      return { valid: true, field: fieldName }
    } catch (error) {
      formState.value.errors[fieldName] = '验证过程出错'
      formState.value.validating[fieldName] = false
      validatingFields.value.delete(fieldName)
      
      return { 
        valid: false, 
        field: fieldName, 
        message: '验证过程出错' 
      }
    }
  }

  // 验证规则
  const validateRule = async (rule: ValidationRule, value: any, fieldName: string): Promise<ValidationResult> => {
    // 必填验证
    if (rule.required && (value === null || value === undefined || value === '' || 
        (Array.isArray(value) && value.length === 0))) {
      return {
        valid: false,
        field: fieldName,
        message: rule.message || `${getFieldLabel(fieldName)}不能为空`
      }
    }

    // 如果值为空且不是必填，跳过其他验证
    if (!rule.required && (value === null || value === undefined || value === '')) {
      return { valid: true, field: fieldName }
    }

    // 类型验证
    if (rule.type) {
      const typeValid = validateType(value, rule.type)
      if (!typeValid) {
        return {
          valid: false,
          field: fieldName,
          message: rule.message || `${getFieldLabel(fieldName)}类型不正确`
        }
      }
    }

    // 长度/大小验证
    if (rule.min !== undefined || rule.max !== undefined) {
      const lengthValid = validateLength(value, rule.min, rule.max)
      if (!lengthValid) {
        return {
          valid: false,
          field: fieldName,
          message: rule.message || `${getFieldLabel(fieldName)}长度不符合要求`
        }
      }
    }

    // 正则验证
    if (rule.pattern) {
      const patternValid = rule.pattern.test(String(value))
      if (!patternValid) {
        return {
          valid: false,
          field: fieldName,
          message: rule.message || `${getFieldLabel(fieldName)}格式不正确`
        }
      }
    }

    // 自定义验证器
    if (rule.validator) {
      const result = await rule.validator(value)
      if (result !== true) {
        return {
          valid: false,
          field: fieldName,
          message: typeof result === 'string' ? result : (rule.message || '验证失败')
        }
      }
    }

    // 异步验证器
    if (rule.asyncValidator) {
      const result = await rule.asyncValidator(value)
      if (result !== true) {
        return {
          valid: false,
          field: fieldName,
          message: typeof result === 'string' ? result : (rule.message || '验证失败')
        }
      }
    }

    return { valid: true, field: fieldName }
  }

  // 类型验证
  const validateType = (value: any, type: string): boolean => {
    switch (type) {
      case 'string':
        return typeof value === 'string'
      case 'number':
        return typeof value === 'number' && !isNaN(value)
      case 'boolean':
        return typeof value === 'boolean'
      case 'array':
        return Array.isArray(value)
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value)
      case 'email':
        return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
      case 'url':
        try {
          new URL(value)
          return true
        } catch {
          return false
        }
      case 'date':
        return value instanceof Date || !isNaN(Date.parse(value))
      default:
        return true
    }
  }

  // 长度验证
  const validateLength = (value: any, min?: number, max?: number): boolean => {
    let length: number

    if (typeof value === 'string' || Array.isArray(value)) {
      length = value.length
    } else if (typeof value === 'number') {
      length = value
    } else {
      return true
    }

    if (min !== undefined && length < min) return false
    if (max !== undefined && length > max) return false
    return true
  }

  // 获取字段标签
  const getFieldLabel = (fieldName: string): string => {
    const field = fields.find(f => f.name === fieldName)
    return field?.label || fieldName
  }

  // 验证整个表单
  const validateForm = async (): Promise<boolean> => {
    const promises = fields.map(field => 
      validateField(field.name, formState.value.values[field.name])
    )

    const results = await Promise.all(promises)
    const isValid = results.every(result => result.valid)
    
    formState.value.isValid = isValid
    return isValid
  }

  // 设置字段值
  const setFieldValue = (fieldName: string, value: any, shouldValidate = true) => {
    formState.value.values[fieldName] = value
    formState.value.touched[fieldName] = true
    formState.value.isDirty = true

    if (shouldValidate) {
      // 防抖验证
      setTimeout(() => {
        validateField(fieldName, value)
      }, 300)
    }

    // 验证依赖字段
    const field = fields.find(f => f.name === fieldName)
    if (field?.dependencies) {
      field.dependencies.forEach(depField => {
        if (formState.value.touched[depField]) {
          setTimeout(() => {
            validateField(depField, formState.value.values[depField])
          }, 300)
        }
      })
    }
  }

  // 设置字段错误
  const setFieldError = (fieldName: string, message: string) => {
    formState.value.errors[fieldName] = message
  }

  // 清除字段错误
  const clearFieldError = (fieldName: string) => {
    delete formState.value.errors[fieldName]
  }

  // 重置表单
  const resetForm = () => {
    initializeForm()
  }

  // 提交表单
  const submitForm = async (onSubmit: (values: Record<string, any>) => Promise<void> | void) => {
    formState.value.isSubmitting = true

    try {
      const isValid = await validateForm()
      if (!isValid) {
        ElMessage.error('表单验证失败，请检查输入')
        return false
      }

      await onSubmit(formState.value.values)
      ElMessage.success('提交成功')
      return true
    } catch (error) {
      ElMessage.error('提交失败: ' + (error instanceof Error ? error.message : '未知错误'))
      return false
    } finally {
      formState.value.isSubmitting = false
    }
  }

  // 计算属性
  const hasErrors = computed(() => Object.keys(formState.value.errors).length > 0)
  const isValidating = computed(() => validatingFields.value.size > 0)

  // 监听表单值变化
  watch(
    () => formState.value.values,
    () => {
      // 检查表单是否有效
      const hasAnyErrors = Object.keys(formState.value.errors).length > 0
      const hasAllRequiredFields = fields
        .filter(field => field.rules.some(rule => rule.required))
        .every(field => {
          const value = formState.value.values[field.name]
          return value !== null && value !== undefined && value !== ''
        })
      
      formState.value.isValid = !hasAnyErrors && hasAllRequiredFields
    },
    { deep: true }
  )

  // 初始化
  initializeForm()

  return {
    formState: readonly(formState),
    isValidating,
    hasErrors,
    validateField,
    validateForm,
    setFieldValue,
    setFieldError,
    clearFieldError,
    resetForm,
    submitForm,
    getFieldError: (fieldName: string) => formState.value.errors[fieldName],
    getFieldValue: (fieldName: string) => formState.value.values[fieldName],
    isFieldTouched: (fieldName: string) => formState.value.touched[fieldName],
    isFieldValidating: (fieldName: string) => formState.value.validating[fieldName]
  }
}

// 预定义验证规则
export const validationRules = {
  required: (message?: string): ValidationRule => ({
    required: true,
    message: message || '此字段为必填项'
  }),

  email: (message?: string): ValidationRule => ({
    type: 'email',
    message: message || '请输入有效的邮箱地址'
  }),

  url: (message?: string): ValidationRule => ({
    type: 'url',
    message: message || '请输入有效的URL地址'
  }),

  minLength: (min: number, message?: string): ValidationRule => ({
    min,
    message: message || `最少需要${min}个字符`
  }),

  maxLength: (max: number, message?: string): ValidationRule => ({
    max,
    message: message || `最多允许${max}个字符`
  }),

  pattern: (pattern: RegExp, message?: string): ValidationRule => ({
    pattern,
    message: message || '格式不正确'
  }),

  numeric: (message?: string): ValidationRule => ({
    type: 'number',
    message: message || '请输入数字'
  }),

  range: (min: number, max: number, message?: string): ValidationRule => ({
    type: 'number',
    min,
    max,
    message: message || `请输入${min}到${max}之间的数字`
  }),

  custom: (validator: (value: any) => boolean | string, message?: string): ValidationRule => ({
    validator,
    message
  }),

  async: (asyncValidator: (value: any) => Promise<boolean | string>, message?: string): ValidationRule => ({
    asyncValidator,
    message
  })
}

// 常用验证模式
export const validationPatterns = {
  phone: /^1[3-9]\d{9}$/,
  idCard: /^[1-9]\d{5}(18|19|20)\d{2}((0[1-9])|(1[0-2]))(([0-2][1-9])|10|20|30|31)\d{3}[0-9Xx]$/,
  zipCode: /^\d{6}$/,
  ipAddress: /^((25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(25[0-5]|2[0-4]\d|[01]?\d\d?)$/,
  macAddress: /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/,
  creditCard: /^\d{13,19}$/,
  hexColor: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/
}
