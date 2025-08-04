<template>
  <div class="json-viewer">
    <div v-if="showCopy" class="viewer-toolbar">
      <el-button size="small" @click="copyToClipboard" :icon="CopyDocument">
        复制
      </el-button>
    </div>

    <div class="json-content">
      <pre :class="{ expanded: expanded > 0 }">{{ formattedData }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { ElMessage } from "element-plus";
import { CopyDocument } from "@element-plus/icons-vue";

interface Props {
  data: any;
  expanded?: number;
  showCopy?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  expanded: 1,
  showCopy: true,
});

const formattedData = computed(() => {
  try {
    return JSON.stringify(props.data, null, 2);
  } catch (error) {
    return "Invalid JSON data";
  }
});

const copyToClipboard = async () => {
  try {
    await navigator.clipboard.writeText(formattedData.value);
    ElMessage.success("已复制到剪贴板");
  } catch (error) {
    ElMessage.error("复制失败");
  }
};
</script>

<style scoped>
.json-viewer {
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  overflow: hidden;
}

.viewer-toolbar {
  display: flex;
  justify-content: flex-end;
  padding: 8px 12px;
  background: var(--el-bg-color-page);
  border-bottom: 1px solid var(--el-border-color);
}

.json-content {
  max-height: 400px;
  overflow: auto;
}

pre {
  margin: 0;
  padding: 16px;
  font-family: "Courier New", Consolas, monospace;
  font-size: 13px;
  line-height: 1.5;
  color: var(--el-text-color-primary);
  background: var(--el-bg-color);
  white-space: pre-wrap;
  word-wrap: break-word;
}

pre.expanded {
  white-space: pre;
}
</style>
