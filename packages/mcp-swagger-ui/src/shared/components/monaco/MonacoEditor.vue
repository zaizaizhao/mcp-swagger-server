<template>
  <div
    ref="monacoContainer"
    class="monaco-editor-container"
    :style="{ height: height + 'px' }"
  />
</template>

<script lang="ts" setup>
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from "vue";
import * as monaco from "monaco-editor";

interface Props {
  modelValue?: string;
  language?: string;
  theme?: string;
  height?: number;
  readOnly?: boolean;
  options?: monaco.editor.IStandaloneEditorConstructionOptions;
}

interface Emits {
  (e: "update:modelValue", value: string): void;
  (e: "change", value: string): void;
  (e: "blur"): void;
  (e: "focus"): void;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: "",
  language: "yaml",
  theme: "vs-dark",
  height: 400,
  readOnly: false,
  options: () => ({}),
});

const emit = defineEmits<Emits>();

const monacoContainer = ref<HTMLElement>();
let editor: monaco.editor.IStandaloneCodeEditor | null = null;
let model: monaco.editor.ITextModel | null = null;

// 初始化Monaco编辑器
const initMonaco = async () => {
  if (!monacoContainer.value) return;

  // 默认编辑器选项
  const defaultOptions: monaco.editor.IStandaloneEditorConstructionOptions = {
    value: props.modelValue,
    language: props.language,
    theme: props.theme,
    readOnly: props.readOnly,
    automaticLayout: true,
    minimap: { enabled: false },
    fontSize: 14,
    lineNumbers: "on",
    wordWrap: "on",
    folding: true,
    foldingStrategy: "indentation",
    renderWhitespace: "boundary",
    scrollBeyondLastLine: false,
    smoothScrolling: true,
    cursorBlinking: "blink",
    cursorSmoothCaretAnimation: "on",
    multiCursorModifier: "ctrlCmd",
    formatOnPaste: true,
    formatOnType: true,
    // 大文件支持配置
    largeFileOptimizations: false,
    maxTokenizationLineLength: 100000,
    stopRenderingLineAfter: 50000,
    // 禁用一些性能消耗大的功能
    renderValidationDecorations: "off",
    // 提高滚动性能
    fastScrollSensitivity: 5,
    scrollbar: {
      useShadows: false,
      verticalHasArrows: false,
      horizontalHasArrows: false,
      vertical: "visible",
      horizontal: "visible",
      verticalScrollbarSize: 10,
      horizontalScrollbarSize: 10,
    },
    ...props.options,
  };

  // 创建编辑器
  editor = monaco.editor.create(monacoContainer.value, defaultOptions);

  // 获取模型
  model = editor.getModel();

  // 监听内容变化
  if (model) {
    model.onDidChangeContent(() => {
      const value = editor?.getValue() || "";
      emit("update:modelValue", value);
      emit("change", value);
    });
  }

  // 监听焦点事件
  editor.onDidFocusEditorWidget(() => {
    emit("focus");
  });

  editor.onDidBlurEditorWidget(() => {
    emit("blur");
  });
};

// 设置编辑器值
const setValue = (value: string) => {
  if (editor && model) {
    const currentValue = model.getValue();
    if (currentValue !== value) {
      model.setValue(value);
    }
  }
};

// 设置编辑器语言
const setLanguage = (language: string) => {
  if (model) {
    monaco.editor.setModelLanguage(model, language);
  }
};

// 设置编辑器主题
const setTheme = (theme: string) => {
  monaco.editor.setTheme(theme);
};

// 格式化代码
const formatDocument = () => {
  if (editor) {
    editor.trigger("", "editor.action.formatDocument", {});
  }
};

// 获取编辑器实例
const getEditor = () => editor;

// 获取模型实例
const getModel = () => model;

// 布局编辑器
const layout = () => {
  if (editor) {
    editor.layout();
  }
};

// 监听属性变化
watch(
  () => props.modelValue,
  (newValue) => {
    setValue(newValue);
  },
);

watch(
  () => props.language,
  (newLanguage) => {
    setLanguage(newLanguage);
  },
);

watch(
  () => props.theme,
  (newTheme) => {
    setTheme(newTheme);
  },
);

watch(
  () => props.readOnly,
  (readOnly) => {
    if (editor) {
      editor.updateOptions({ readOnly });
    }
  },
);

// 生命周期
onMounted(async () => {
  await nextTick();
  await initMonaco();
});

onBeforeUnmount(() => {
  if (editor) {
    editor.dispose();
    editor = null;
  }
  if (model) {
    model.dispose();
    model = null;
  }
});

// 暴露方法
defineExpose({
  setValue,
  setLanguage,
  setTheme,
  formatDocument,
  getEditor,
  getModel,
  layout,
});
</script>

<style scoped>
.monaco-editor-container {
  width: 100%;
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  overflow: hidden;
}

.monaco-editor-container :deep(.monaco-editor) {
  font-family: "Monaco", "Menlo", "Ubuntu Mono", monospace;
}

.monaco-editor-container :deep(.monaco-editor .margin) {
  background-color: var(--el-bg-color-page);
}

.monaco-editor-container :deep(.monaco-editor .monaco-editor-background) {
  background-color: var(--el-bg-color);
}
</style>
