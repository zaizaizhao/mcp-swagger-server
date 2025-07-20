<template>
  <div class="monaco-editor-wrapper">
    <textarea
      ref="textareaRef"
      :value="modelValue"
      @input="handleInput"
      :placeholder="placeholder"
      :style="{ height: height + 'px' }"
      class="monaco-textarea"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

interface Props {
  modelValue: string
  language?: string
  height?: number
  options?: any
  placeholder?: string
}

interface Emits {
  (e: 'update:modelValue', value: string): void
  (e: 'change', value: string): void
}

const props = withDefaults(defineProps<Props>(), {
  language: 'json',
  height: 200,
  placeholder: '请输入内容...'
})

const emit = defineEmits<Emits>()

const textareaRef = ref<HTMLTextAreaElement>()

const handleInput = (event: Event) => {
  const target = event.target as HTMLTextAreaElement
  const value = target.value
  emit('update:modelValue', value)
  emit('change', value)
}
</script>

<style scoped>
.monaco-editor-wrapper {
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  overflow: hidden;
}

.monaco-textarea {
  width: 100%;
  border: none;
  outline: none;
  resize: none;
  padding: 12px;
  font-family: 'Courier New', Consolas, monospace;
  font-size: 13px;
  line-height: 1.5;
  color: var(--el-text-color-primary);
  background: var(--el-bg-color);
}

.monaco-textarea:focus {
  box-shadow: 0 0 0 2px var(--el-color-primary-light-8);
}
</style>
