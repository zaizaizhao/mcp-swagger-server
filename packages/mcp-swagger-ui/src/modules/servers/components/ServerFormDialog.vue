<template>
  <el-dialog
    v-model="dialogVisible"
    :title="isEdit ? t('servers.editServer') : t('servers.createServer')"
    width="600px"
    :close-on-click-modal="false"
    @close="handleClose"
  >
    <el-form
      ref="formRef"
      :model="formData"
      :rules="formRules"
      label-width="120px"
      label-position="right"
    >
      <el-form-item :label="t('servers.serverNameLabel')" prop="name" required>
        <el-input
          v-model="formData.name"
          :placeholder="t('servers.serverNamePlaceholder')"
          clearable
        />
      </el-form-item>

      <el-form-item :label="t('servers.versionLabel')" prop="version">
        <el-input
          v-model="formData.version"
          :placeholder="t('servers.versionPlaceholder')"
          clearable
        />
      </el-form-item>

      <el-form-item :label="t('servers.portLabel')" prop="port">
        <el-input-number
          v-model="formData.port"
          :min="1"
          :max="65535"
          :placeholder="t('servers.portPlaceholder')"
          style="width: 100%"
        />
      </el-form-item>

      <el-form-item :label="t('servers.transportTypeLabel')" prop="transport">
        <el-select
          v-model="formData.transport"
          :placeholder="t('servers.transportTypePlaceholder')"
          style="width: 100%"
        >
          <el-option label="Streamable" value="streamable" />
          <el-option label="Server-Sent Events" value="sse" />
        </el-select>
      </el-form-item>

      <el-form-item
        :label="t('servers.openApiDocLabel')"
        prop="openApiDocumentId"
        required
      >
        <el-select
          v-model="formData.openApiDocumentId"
          :placeholder="t('servers.openApiDocPlaceholder')"
          style="width: 100%"
          :loading="documentsLoading"
          filterable
        >
          <el-option
            v-for="doc in availableDocuments"
            :key="doc.id"
            :label="`${doc.name} (v${doc.version || '1.0.0'})`"
            :value="doc.id"
          >
            <div
              style="
                display: flex;
                justify-content: space-between;
                align-items: center;
              "
            >
              <span>
                <el-icon style="margin-right: 8px"><Document /></el-icon>
                {{ doc.name }}
              </span>
              <span
                style="color: var(--el-text-color-secondary); font-size: 12px"
              >
                v{{ doc.version || "1.0.0" }}
              </span>
            </div>
          </el-option>
          <template #empty>
            <div
              style="
                padding: 20px;
                text-align: center;
                color: var(--el-text-color-secondary);
              "
            >
              {{
                documentsLoading
                  ? t("servers.loading")
                  : t("servers.noAvailableOpenApiDocs")
              }}
            </div>
          </template>
        </el-select>
        <div
          style="
            margin-top: 4px;
            font-size: 12px;
            color: var(--el-text-color-secondary);
          "
        >
          {{ t("servers.onlyValidDocsShown") }}
        </div>
      </el-form-item>

      <el-form-item :label="t('servers.autoStartLabel')" prop="autoStart">
        <el-switch
          v-model="formData.autoStart"
          :active-text="t('servers.yes')"
          :inactive-text="t('servers.no')"
        />
      </el-form-item>

      <el-form-item :label="t('servers.descriptionLabel')" prop="description">
        <el-input
          v-model="formData.description"
          type="textarea"
          :rows="3"
          :placeholder="t('servers.descriptionPlaceholder')"
        />
      </el-form-item>

      <el-form-item :label="t('servers.tagsLabel')" prop="tags">
        <el-tag
          v-for="tag in formData.tags"
          :key="tag"
          closable
          :disable-transitions="false"
          @close="handleTagClose(tag)"
          class="tag-item"
        >
          {{ tag }}
        </el-tag>
        <el-input
          v-if="inputVisible"
          ref="InputRef"
          v-model="inputValue"
          class="tag-input"
          size="small"
          @keyup.enter="handleInputConfirm"
          @blur="handleInputConfirm"
        />
        <el-button v-else class="tag-button" size="small" @click="showInput">
          {{ t("servers.addTag") }}
        </el-button>
      </el-form-item>

      <el-form-item
        :label="t('servers.customHeadersLabel')"
        prop="customHeaders"
      >
        <div class="headers-section">
          <div
            v-for="(header, index) in customHeadersList"
            :key="index"
            class="header-row"
          >
            <el-input
              v-model="header.key"
              :placeholder="t('servers.headerNamePlaceholder')"
              class="header-key"
            />
            <el-input
              v-model="header.value"
              :placeholder="t('servers.headerValuePlaceholder')"
              class="header-value"
            />
            <el-button
              type="danger"
              :icon="Delete"
              @click="removeHeader(index)"
              circle
              size="small"
            />
          </div>
          <el-button
            type="primary"
            :icon="Plus"
            @click="addHeader"
            size="small"
            plain
          >
            {{ t("servers.addHeader") }}
          </el-button>
        </div>
      </el-form-item>
    </el-form>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleClose"> {{ t("servers.cancel") }} </el-button>
        <el-button type="primary" :loading="loading" @click="handleSubmit">
          {{ isEdit ? t("servers.update") : t("servers.create") }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from "vue";
import { ElMessage, type FormInstance, type FormRules } from "element-plus";
import { Plus, Delete, Document } from "@element-plus/icons-vue";
import type { MCPServer, ServerConfig } from "@/types";
import { useServerStore } from "@/stores/server";
import {
  documentsApi,
  type Document as OpenAPIDocument,
} from "@/api/documents";
import { useI18n } from "vue-i18n";

// 导入全局功能
import { usePerformanceMonitor } from "@/composables/usePerformance";

interface Props {
  modelValue: boolean;
  server?: MCPServer | null;
}

interface Emits {
  (e: "update:modelValue", value: boolean): void;
  (e: "success"): void;
}

const props = withDefaults(defineProps<Props>(), {
  server: null,
});

const emit = defineEmits<Emits>();
const serverStore = useServerStore();
const { t } = useI18n();

// 全局功能
const { measureFunction } = usePerformanceMonitor();

// 响应式数据
const formRef = ref<FormInstance>();
const loading = ref(false);
const inputVisible = ref(false);
const inputValue = ref("");
const InputRef = ref();
const availableDocuments = ref<OpenAPIDocument[]>([]);
const documentsLoading = ref(false);

// 表单数据
const formData = ref<ServerConfig & { openApiDocumentId?: string }>({
  name: "",
  version: "",
  description: "",
  port: 3000,
  transport: "streamable",
  openApiData: {},
  config: {},
  authConfig: "",
  autoStart: false,
  tags: [],
  openApiDocumentId: "",
  // 兼容旧字段
  endpoint: "",
  customHeaders: {},
});

// 自定义头部列表
const customHeadersList = ref<Array<{ key: string; value: string }>>([]);

// 计算属性
const dialogVisible = computed({
  get: () => props.modelValue,
  set: (value) => emit("update:modelValue", value),
});

const isEdit = computed(() => !!props.server);

// 表单验证规则
const formRules: FormRules = {
  name: [
    {
      required: true,
      message: t("servers.serverNameRequired"),
      trigger: "blur",
    },
    {
      min: 2,
      max: 50,
      message: t("servers.serverNameLength"),
      trigger: "blur",
    },
  ],
  version: [{ max: 20, message: t("servers.versionLength"), trigger: "blur" }],
  port: [
    {
      type: "number",
      min: 1,
      max: 65535,
      message: t("servers.portRange"),
      trigger: "blur",
    },
  ],
  transport: [
    {
      required: true,
      message: t("servers.transportTypeRequired"),
      trigger: "change",
    },
  ],
  openApiDocumentId: [
    {
      required: true,
      message: t("servers.openApiDocRequired"),
      trigger: "change",
    },
  ],
  description: [
    { max: 200, message: t("servers.descriptionLength"), trigger: "blur" },
  ],
};

// 方法
const resetForm = () => {
  formData.value = {
    name: "",
    version: "",
    description: "",
    port: 3000,
    transport: "streamable",
    openApiData: {},
    config: {},
    authConfig: "",
    autoStart: false,
    tags: [],
    openApiDocumentId: "",
    // 兼容旧字段
    endpoint: "",
    customHeaders: {},
  };
  customHeadersList.value = [];
  formRef.value?.clearValidate();
};

// 监听服务器属性变化
watch(
  () => props.server,
  (server) => {
    if (server) {
      formData.value = {
        name: server.name,
        version: server.version || "",
        description: server.description || "",
        port: server.port || 3000,
        transport: server.transport || "streamable",
        openApiData: {},
        config: {},
        authConfig: "",
        autoStart: server.autoStart || false,
        tags: server.tags || [],
        openApiDocumentId: (server.config as any)?.openApiDocumentId || "",
        // 兼容旧字段
        endpoint: server.endpoint || "",
        customHeaders: server.config?.customHeaders || {},
      };

      // 转换自定义头部为列表格式
      customHeadersList.value = Object.entries(
        formData.value.customHeaders || {},
      ).map(([key, value]) => ({ key, value }));
    } else {
      resetForm();
    }
  },
  { immediate: true },
);

// 监听对话框可见性
watch(dialogVisible, (visible) => {
  if (visible && !props.server) {
    resetForm();
  }
  if (visible) {
    loadAvailableDocuments();
  }
});

// 加载可用的OpenAPI文档
const loadAvailableDocuments = async () => {
  try {
    documentsLoading.value = true;
    const documents = await documentsApi.getDocuments();
    // 只显示有效的文档
    availableDocuments.value = documents.filter(
      (doc) => doc.status === "valid",
    );
  } catch (error) {
    console.error("Failed to load OpenAPI documents:", error);
    ElMessage.error(t("servers.loadOpenApiDocFailed"));
    availableDocuments.value = [];
  } finally {
    documentsLoading.value = false;
  }
};

const handleClose = () => {
  emit("update:modelValue", false);
};

const handleSubmit = async () => {
  try {
    // 使用Element Plus表单验证
    if (!formRef.value) {
      ElMessage.error(t("servers.formRefNotFound"));
      return;
    }

    const isValid = await formRef.value.validate().catch(() => false);
    if (!isValid) {
      ElMessage.error(t("servers.checkFormInput"));
      return;
    }

    loading.value = true;

    // 转换自定义头部回对象格式
    const customHeaders: Record<string, string> = {};
    customHeadersList.value.forEach(({ key, value }) => {
      if (key.trim() && value.trim()) {
        customHeaders[key.trim()] = value.trim();
      }
    });

    const serverConfig: ServerConfig = {
      name: formData.value.name,
      version: formData.value.version,
      description: formData.value.description,
      port: formData.value.port,
      transport: formData.value.transport,
      openApiData: formData.value.openApiData || {},
      config: {
        customHeaders,
        openApiDocumentId: formData.value.openApiDocumentId,
      },
      authConfig: formData.value.authConfig,
      autoStart: formData.value.autoStart,
      tags: formData.value.tags?.filter((tag) => tag.trim()) || [],
      // 兼容旧字段
      endpoint: formData.value.endpoint,
    };
    console.log(serverConfig);
    let success = false;

    if (isEdit.value && props.server) {
      success = await measureFunction("updateServer", async () => {
        return await serverStore.updateServer(props.server!.id, serverConfig);
      });
    } else {
      success = await measureFunction("createServer", async () => {
        return await serverStore.createServer(serverConfig);
      });
    }

    if (success) {
      ElMessage.success(
        isEdit.value
          ? t("servers.serverUpdateSuccess")
          : t("servers.serverCreateSuccess"),
      );
      emit("success");
    }
  } catch (error) {
    ElMessage.error(
      `${isEdit.value ? t("servers.updateServerFailed") : t("servers.createServerFailed")}: ${error}`,
    );
  } finally {
    loading.value = false;
  }
};

// 组件挂载时初始化
onMounted(() => {
  loadAvailableDocuments();
});

// 标签相关方法
const handleTagClose = (tag: string) => {
  formData.value.tags = formData.value.tags?.filter((t) => t !== tag);
};

const showInput = () => {
  inputVisible.value = true;
  nextTick(() => {
    InputRef.value?.input?.focus();
  });
};

const handleInputConfirm = () => {
  if (inputValue.value) {
    if (!formData.value.tags) {
      formData.value.tags = [];
    }
    if (!formData.value.tags.includes(inputValue.value)) {
      formData.value.tags.push(inputValue.value);
    }
  }
  inputVisible.value = false;
  inputValue.value = "";
};

// 自定义头部相关方法
const addHeader = () => {
  customHeadersList.value.push({ key: "", value: "" });
};

const removeHeader = (index: number) => {
  customHeadersList.value.splice(index, 1);
};
</script>

<style scoped>
.tag-item {
  margin-right: 8px;
  margin-bottom: 8px;
}

.tag-input {
  width: 90px;
  margin-right: 8px;
  margin-bottom: 8px;
}

.tag-button {
  margin-bottom: 8px;
}

.headers-section {
  width: 100%;
}

.header-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.header-key {
  flex: 1;
}

.header-value {
  flex: 2;
}

.dialog-footer {
  text-align: right;
}
</style>
