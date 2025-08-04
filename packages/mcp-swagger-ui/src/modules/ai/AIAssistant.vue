<template>
  <div class="ai-assistant">
    <!-- 页面头部 -->
    <div class="header-section">
      <div class="header-content">
        <h1>
          <el-icon><Service /></el-icon>
          AI助手集成配置
        </h1>
        <p class="header-description">
          配置与Claude、ChatGPT等AI助手的集成，快速生成MCP配置文件
        </p>
      </div>

      <div class="header-actions">
        <el-button type="primary" @click="showCreateDialog" :icon="Plus">
          新建配置
        </el-button>
        <el-button @click="showTemplateManager" :icon="Folder">
          模板管理
        </el-button>
        <el-button @click="importConfig" :icon="Upload"> 导入配置 </el-button>
      </div>
    </div>

    <!-- AI助手类型选择 -->
    <div class="assistant-types-section">
      <el-card shadow="never">
        <template #header>
          <div class="card-header">
            <span>选择AI助手类型</span>
            <el-tag type="info" size="small">{{
              selectedType
                ? `已选择：${getAssistantName(selectedType)}`
                : "请选择助手类型"
            }}</el-tag>
          </div>
        </template>

        <div class="assistant-grid">
          <div
            v-for="assistant in assistantTypes"
            :key="assistant.type"
            :class="[
              'assistant-card',
              { active: selectedType === assistant.type },
            ]"
            @click="selectAssistant(assistant.type)"
          >
            <div class="assistant-icon">
              <el-icon :size="32" :color="assistant.color">
                <component :is="assistant.icon" />
              </el-icon>
            </div>
            <div class="assistant-info">
              <h3>{{ assistant.name }}</h3>
              <p>{{ assistant.description }}</p>
              <div class="assistant-features">
                <el-tag
                  v-for="feature in assistant.features"
                  :key="feature"
                  size="small"
                  type="success"
                  effect="plain"
                >
                  {{ feature }}
                </el-tag>
              </div>
            </div>
            <div class="assistant-status">
              <el-badge
                :value="assistant.configCount"
                :hidden="assistant.configCount === 0"
                class="config-badge"
              >
                <el-button size="small" circle>
                  <el-icon><Setting /></el-icon>
                </el-button>
              </el-badge>
            </div>
          </div>
        </div>
      </el-card>
    </div>

    <!-- 配置生成区域 -->
    <div v-if="selectedType" class="config-section">
      <el-row :gutter="20">
        <!-- 左侧：配置表单 -->
        <el-col :span="12">
          <el-card shadow="never">
            <template #header>
              <div class="card-header">
                <span>配置参数</span>
                <el-button-group>
                  <el-button
                    size="small"
                    @click="useTemplate"
                    :icon="Promotion"
                  >
                    使用模板
                  </el-button>
                  <el-button
                    size="small"
                    @click="resetConfig"
                    :icon="RefreshRight"
                  >
                    重置
                  </el-button>
                </el-button-group>
              </div>
            </template>

            <el-form
              ref="configFormRef"
              :model="configForm"
              :rules="configRules"
              label-width="120px"
              @submit.prevent
            >
              <!-- 基础配置 -->
              <el-form-item label="配置名称" prop="name">
                <el-input
                  v-model="configForm.name"
                  placeholder="输入配置名称"
                  :prefix-icon="Edit"
                />
              </el-form-item>

              <el-form-item label="服务器地址" prop="serverUrl">
                <el-input
                  v-model="configForm.serverUrl"
                  placeholder="MCP服务器地址"
                  :prefix-icon="Link"
                />
              </el-form-item>

              <!-- 动态配置字段 -->
              <template
                v-for="field in getConfigFields(selectedType)"
                :key="field.key"
              >
                <el-form-item :label="field.label" :prop="field.key">
                  <component
                    :is="field.component"
                    v-model="configForm[field.key]"
                    v-bind="field.props"
                    @change="generateConfig"
                  />
                </el-form-item>
              </template>

              <!-- 高级选项 -->
              <el-collapse v-model="advancedCollapse">
                <el-collapse-item title="高级选项" name="advanced">
                  <el-form-item label="超时设置">
                    <el-input-number
                      v-model="configForm.timeout"
                      :min="1000"
                      :max="60000"
                      :step="1000"
                      controls-position="right"
                      style="width: 100%"
                    />
                    <div class="form-hint">请求超时时间 (毫秒)</div>
                  </el-form-item>

                  <el-form-item label="重试次数">
                    <el-input-number
                      v-model="configForm.retries"
                      :min="0"
                      :max="10"
                      controls-position="right"
                      style="width: 100%"
                    />
                  </el-form-item>

                  <el-form-item label="启用日志">
                    <el-switch
                      v-model="configForm.enableLogging"
                      active-text="开启"
                      inactive-text="关闭"
                    />
                  </el-form-item>

                  <el-form-item label="自定义标签">
                    <el-select
                      v-model="configForm.tags"
                      multiple
                      filterable
                      allow-create
                      placeholder="添加标签"
                      style="width: 100%"
                    >
                      <el-option
                        v-for="tag in commonTags"
                        :key="tag"
                        :label="tag"
                        :value="tag"
                      />
                    </el-select>
                  </el-form-item>
                </el-collapse-item>
              </el-collapse>
            </el-form>
          </el-card>
        </el-col>

        <!-- 右侧：配置预览 -->
        <el-col :span="12">
          <el-card shadow="never">
            <template #header>
              <div class="card-header">
                <span>配置预览</span>
                <el-button-group>
                  <el-button size="small" @click="validateConfig" :icon="Check">
                    验证
                  </el-button>
                  <el-button
                    size="small"
                    @click="copyConfig"
                    :icon="DocumentCopy"
                  >
                    复制
                  </el-button>
                  <el-button
                    size="small"
                    @click="exportConfig"
                    :icon="Download"
                  >
                    导出
                  </el-button>
                </el-button-group>
              </div>
            </template>

            <!-- 配置格式选择 -->
            <div class="format-tabs">
              <el-radio-group v-model="previewFormat" @change="generateConfig">
                <el-radio-button label="json">JSON</el-radio-button>
                <el-radio-button label="yaml">YAML</el-radio-button>
                <el-radio-button label="toml">TOML</el-radio-button>
              </el-radio-group>
            </div>

            <!-- 代码编辑器 -->
            <div class="config-editor">
              <pre class="config-preview">{{ generatedConfig }}</pre>
            </div>

            <!-- 验证状态 -->
            <div v-if="validationResult" class="validation-result">
              <el-alert
                :type="validationResult.valid ? 'success' : 'error'"
                :title="
                  validationResult.valid ? '配置验证通过' : '配置验证失败'
                "
                :description="validationResult.message"
                show-icon
                :closable="false"
              />
            </div>
          </el-card>
        </el-col>
      </el-row>
    </div>

    <!-- 配置历史 -->
    <div v-if="selectedType" class="history-section">
      <el-card shadow="never">
        <template #header>
          <div class="card-header">
            <span>配置历史</span>
            <el-button
              size="small"
              @click="clearHistory"
              :icon="Delete"
              type="danger"
            >
              清空历史
            </el-button>
          </div>
        </template>

        <div v-if="configHistory.length === 0" class="empty-history">
          <el-empty description="暂无配置历史" />
        </div>

        <div v-else class="history-list">
          <div
            v-for="(item, index) in configHistory"
            :key="index"
            class="history-item"
          >
            <div class="history-info">
              <div class="history-name">{{ item.name }}</div>
              <div class="history-meta">
                <el-tag size="small" type="info">{{
                  item.assistantType
                }}</el-tag>
                <span class="history-time">{{
                  formatTime(item.createdAt)
                }}</span>
              </div>
            </div>
            <div class="history-actions">
              <el-button size="small" @click="loadHistory(item)" :icon="View">
                查看
              </el-button>
              <el-button
                size="small"
                @click="useHistory(item)"
                :icon="CopyDocument"
              >
                使用
              </el-button>
              <el-button
                size="small"
                @click="deleteHistory(index)"
                :icon="Delete"
                type="danger"
              >
                删除
              </el-button>
            </div>
          </div>
        </div>
      </el-card>
    </div>

    <!-- 创建配置对话框 -->
    <el-dialog
      v-model="createDialogVisible"
      title="创建新配置"
      width="600px"
      :close-on-click-modal="false"
    >
      <el-form :model="newConfigForm" label-width="100px">
        <el-form-item label="配置名称">
          <el-input v-model="newConfigForm.name" placeholder="输入配置名称" />
        </el-form-item>
        <el-form-item label="AI助手类型">
          <el-select
            v-model="newConfigForm.type"
            placeholder="选择AI助手类型"
            style="width: 100%"
          >
            <el-option
              v-for="assistant in assistantTypes"
              :key="assistant.type"
              :label="assistant.name"
              :value="assistant.type"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="描述">
          <el-input
            v-model="newConfigForm.description"
            type="textarea"
            :rows="3"
            placeholder="配置描述（可选）"
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="createDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="createNewConfig">创建</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 模板管理对话框 -->
    <el-dialog
      v-model="templateDialogVisible"
      title="配置模板管理"
      width="800px"
      :close-on-click-modal="false"
    >
      <div class="template-manager">
        <div class="template-actions">
          <el-button type="primary" @click="saveAsTemplate" :icon="Plus">
            保存为模板
          </el-button>
          <el-button @click="importTemplate" :icon="Upload">
            导入模板
          </el-button>
        </div>

        <el-table :data="configTemplates" style="width: 100%">
          <el-table-column prop="name" label="模板名称" />
          <el-table-column prop="assistantType" label="AI类型" />
          <el-table-column prop="description" label="描述" />
          <el-table-column prop="createdAt" label="创建时间">
            <template #default="{ row }">
              {{ formatTime(row.createdAt) }}
            </template>
          </el-table-column>
          <el-table-column label="操作" width="200">
            <template #default="{ row, $index }">
              <el-button
                size="small"
                @click="useConfigTemplate(row)"
                :icon="Tools"
              >
                使用
              </el-button>
              <el-button size="small" @click="editTemplate(row)" :icon="Edit">
                编辑
              </el-button>
              <el-button
                size="small"
                @click="deleteTemplate($index)"
                :icon="Delete"
                type="danger"
              >
                删除
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="templateDialogVisible = false">关闭</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, reactive, watch } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  Service,
  Plus,
  Folder,
  Upload,
  Setting,
  Promotion,
  RefreshRight,
  Edit,
  Link,
  Check,
  DocumentCopy,
  Download,
  Delete,
  View,
  CopyDocument,
  Tools,
} from "@element-plus/icons-vue";

// 定义接口
interface AssistantType {
  type: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  features: string[];
  configCount: number;
}

interface ConfigForm {
  name: string;
  serverUrl: string;
  timeout: number;
  retries: number;
  enableLogging: boolean;
  tags: string[];
  [key: string]: any;
}

interface ConfigField {
  key: string;
  label: string;
  component: string;
  props: Record<string, any>;
  required?: boolean;
}

interface ValidationResult {
  valid: boolean;
  message: string;
}

interface ConfigHistory {
  name: string;
  assistantType: string;
  config: string;
  createdAt: Date;
}

interface ConfigTemplate {
  name: string;
  assistantType: string;
  description: string;
  config: ConfigForm;
  createdAt: Date;
}

// 响应式数据
const selectedType = ref<string>("");
const configFormRef = ref();
const previewFormat = ref<"json" | "yaml" | "toml">("json");
const generatedConfig = ref("");
const validationResult = ref<ValidationResult | null>(null);
const advancedCollapse = ref<string[]>([]);

// 对话框状态
const createDialogVisible = ref(false);
const templateDialogVisible = ref(false);

// 表单数据
const configForm = reactive<ConfigForm>({
  name: "",
  serverUrl: "http://localhost:3000",
  timeout: 30000,
  retries: 3,
  enableLogging: true,
  tags: [],
});

const newConfigForm = reactive({
  name: "",
  type: "",
  description: "",
});

// 历史记录和模板
const configHistory = ref<ConfigHistory[]>([]);
const configTemplates = ref<ConfigTemplate[]>([]);

// AI助手类型定义
const assistantTypes = ref<AssistantType[]>([
  {
    type: "claude",
    name: "Claude",
    description: "Anthropic Claude AI助手，支持高质量对话和代码生成",
    icon: "ChatDotRound",
    color: "#FF6B35",
    features: ["对话", "代码生成", "文本分析"],
    configCount: 0,
  },
  {
    type: "chatgpt",
    name: "ChatGPT",
    description: "OpenAI ChatGPT，强大的语言模型和对话AI",
    icon: "ChatLineRound",
    color: "#00A67E",
    features: ["对话", "创作", "问答"],
    configCount: 0,
  },
  {
    type: "copilot",
    name: "GitHub Copilot",
    description: "GitHub Copilot，专业的代码助手和编程AI",
    icon: "Monitor",
    color: "#0969DA",
    features: ["代码补全", "代码审查", "文档生成"],
    configCount: 0,
  },
  {
    type: "gemini",
    name: "Google Gemini",
    description: "Google Gemini AI，多模态AI助手",
    icon: "Star",
    color: "#4285F4",
    features: ["多模态", "推理", "创意"],
    configCount: 0,
  },
  {
    type: "custom",
    name: "自定义助手",
    description: "自定义AI助手配置，支持任意API端点",
    icon: "Tools",
    color: "#9333EA",
    features: ["自定义", "灵活配置", "API集成"],
    configCount: 0,
  },
]);

// 常用标签
const commonTags = ref([
  "production",
  "development",
  "testing",
  "staging",
  "api",
  "chat",
  "analysis",
  "generation",
]);

// 表单验证规则
const configRules = {
  name: [{ required: true, message: "请输入配置名称", trigger: "blur" }],
  serverUrl: [{ required: true, message: "请输入服务器地址", trigger: "blur" }],
};

// 计算属性
const getAssistantName = computed(() => {
  return (type: string) => {
    const assistant = assistantTypes.value.find((a) => a.type === type);
    return assistant?.name || type;
  };
});

// 方法
const selectAssistant = (type: string) => {
  selectedType.value = type;
  resetConfig();
  generateConfig();
};

const getConfigFields = (type: string): ConfigField[] => {
  const baseFields: ConfigField[] = [];

  switch (type) {
    case "claude":
      baseFields.push(
        {
          key: "apiKey",
          label: "API密钥",
          component: "el-input",
          props: {
            type: "password",
            placeholder: "输入Anthropic API密钥",
            showPassword: true,
          },
          required: true,
        },
        {
          key: "model",
          label: "模型选择",
          component: "el-select",
          props: {
            placeholder: "选择Claude模型",
            style: "width: 100%",
          },
        },
        {
          key: "maxTokens",
          label: "最大令牌数",
          component: "el-input-number",
          props: {
            min: 1,
            max: 100000,
            step: 1000,
            controlsPosition: "right",
            style: "width: 100%",
          },
        },
      );
      break;

    case "chatgpt":
      baseFields.push(
        {
          key: "apiKey",
          label: "API密钥",
          component: "el-input",
          props: {
            type: "password",
            placeholder: "输入OpenAI API密钥",
            showPassword: true,
          },
          required: true,
        },
        {
          key: "model",
          label: "模型选择",
          component: "el-select",
          props: {
            placeholder: "选择GPT模型",
            style: "width: 100%",
          },
        },
        {
          key: "temperature",
          label: "创造性",
          component: "el-slider",
          props: {
            min: 0,
            max: 2,
            step: 0.1,
            showStops: true,
          },
        },
      );
      break;

    case "copilot":
      baseFields.push(
        {
          key: "accessToken",
          label: "访问令牌",
          component: "el-input",
          props: {
            type: "password",
            placeholder: "输入GitHub访问令牌",
            showPassword: true,
          },
          required: true,
        },
        {
          key: "suggestions",
          label: "建议数量",
          component: "el-input-number",
          props: {
            min: 1,
            max: 10,
            controlsPosition: "right",
            style: "width: 100%",
          },
        },
      );
      break;

    case "gemini":
      baseFields.push(
        {
          key: "apiKey",
          label: "API密钥",
          component: "el-input",
          props: {
            type: "password",
            placeholder: "输入Google API密钥",
            showPassword: true,
          },
          required: true,
        },
        {
          key: "model",
          label: "模型版本",
          component: "el-select",
          props: {
            placeholder: "选择Gemini模型",
            style: "width: 100%",
          },
        },
      );
      break;

    case "custom":
      baseFields.push(
        {
          key: "endpoint",
          label: "API端点",
          component: "el-input",
          props: {
            placeholder: "自定义API端点URL",
          },
          required: true,
        },
        {
          key: "headers",
          label: "请求头",
          component: "el-input",
          props: {
            type: "textarea",
            rows: 3,
            placeholder: '{"Authorization": "Bearer token"}',
          },
        },
      );
      break;
  }

  return baseFields;
};

const generateConfig = () => {
  if (!selectedType.value) return;

  const config = {
    type: "mcp-server",
    name:
      configForm.name || `${getAssistantName.value(selectedType.value)} Config`,
    assistant: {
      type: selectedType.value,
      ...Object.fromEntries(
        Object.entries(configForm).filter(
          ([key]) =>
            ![
              "name",
              "serverUrl",
              "timeout",
              "retries",
              "enableLogging",
              "tags",
            ].includes(key),
        ),
      ),
    },
    server: {
      url: configForm.serverUrl,
      timeout: configForm.timeout,
      retries: configForm.retries,
    },
    logging: {
      enabled: configForm.enableLogging,
      level: "info",
    },
    tags: configForm.tags,
    createdAt: new Date().toISOString(),
  };

  // 简化处理，实际应该使用对应的库来转换格式
  generatedConfig.value = JSON.stringify(config, null, 2);
};

const validateConfig = () => {
  try {
    const config = JSON.parse(generatedConfig.value);

    // 基础验证
    if (!config.name) {
      throw new Error("配置名称不能为空");
    }

    if (!config.assistant?.type) {
      throw new Error("AI助手类型不能为空");
    }

    if (!config.server?.url) {
      throw new Error("服务器URL不能为空");
    }

    // 特定类型验证
    switch (config.assistant.type) {
      case "claude":
      case "chatgpt":
      case "gemini":
        if (!config.assistant.apiKey) {
          throw new Error("API密钥不能为空");
        }
        break;
      case "copilot":
        if (!config.assistant.accessToken) {
          throw new Error("访问令牌不能为空");
        }
        break;
      case "custom":
        if (!config.assistant.endpoint) {
          throw new Error("自定义端点不能为空");
        }
        break;
    }

    validationResult.value = {
      valid: true,
      message: "配置验证通过，所有必填字段都已正确填写",
    };

    ElMessage.success("配置验证通过");
  } catch (error) {
    validationResult.value = {
      valid: false,
      message: error instanceof Error ? error.message : "配置格式错误",
    };

    ElMessage.error("配置验证失败: " + validationResult.value.message);
  }
};

const copyConfig = async () => {
  try {
    await navigator.clipboard.writeText(generatedConfig.value);
    ElMessage.success("配置已复制到剪贴板");
  } catch (error) {
    ElMessage.error("复制失败");
  }
};

const exportConfig = () => {
  const blob = new Blob([generatedConfig.value], {
    type: previewFormat.value === "json" ? "application/json" : "text/plain",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${configForm.name || "config"}.${previewFormat.value}`;
  a.click();
  URL.revokeObjectURL(url);

  ElMessage.success("配置已导出");
};

const resetConfig = () => {
  Object.assign(configForm, {
    name: "",
    serverUrl: "http://localhost:3000",
    timeout: 30000,
    retries: 3,
    enableLogging: true,
    tags: [],
  });

  // 清空动态字段
  const fields = getConfigFields(selectedType.value);
  fields.forEach((field) => {
    delete configForm[field.key];
  });

  generateConfig();
};

const saveToHistory = () => {
  if (!generatedConfig.value || !selectedType.value) return;

  const historyItem: ConfigHistory = {
    name:
      configForm.name || `${getAssistantName.value(selectedType.value)} Config`,
    assistantType: selectedType.value,
    config: generatedConfig.value,
    createdAt: new Date(),
  };

  configHistory.value.unshift(historyItem);

  // 限制历史记录数量
  if (configHistory.value.length > 20) {
    configHistory.value = configHistory.value.slice(0, 20);
  }
};

const loadHistory = (item: ConfigHistory) => {
  generatedConfig.value = item.config;
  ElMessage.success("配置已加载到预览区域");
};

const useHistory = (item: ConfigHistory) => {
  try {
    const config = JSON.parse(item.config);

    // 恢复表单数据
    Object.assign(configForm, {
      name: config.name,
      serverUrl: config.server?.url || "http://localhost:3000",
      timeout: config.server?.timeout || 30000,
      retries: config.server?.retries || 3,
      enableLogging: config.logging?.enabled !== false,
      tags: config.tags || [],
    });

    // 恢复AI助手特定字段
    if (config.assistant) {
      Object.assign(configForm, config.assistant);
    }

    selectedType.value = config.assistant?.type || item.assistantType;
    generateConfig();

    ElMessage.success("配置已应用到表单");
  } catch (error) {
    ElMessage.error("配置格式错误，无法应用");
  }
};

const deleteHistory = (index: number) => {
  configHistory.value.splice(index, 1);
  ElMessage.success("历史记录已删除");
};

const clearHistory = async () => {
  try {
    await ElMessageBox.confirm(
      "确定要清空所有配置历史吗？此操作不可恢复。",
      "确认清空",
      {
        confirmButtonText: "确定",
        cancelButtonText: "取消",
        type: "warning",
      },
    );

    configHistory.value = [];
    ElMessage.success("配置历史已清空");
  } catch {
    // 用户取消操作
  }
};

const formatTime = (date: Date) => {
  return date.toLocaleString("zh-CN");
};

const showCreateDialog = () => {
  Object.assign(newConfigForm, {
    name: "",
    type: "",
    description: "",
  });
  createDialogVisible.value = true;
};

const createNewConfig = () => {
  if (!newConfigForm.name || !newConfigForm.type) {
    ElMessage.warning("请填写配置名称和AI助手类型");
    return;
  }

  selectedType.value = newConfigForm.type;
  configForm.name = newConfigForm.name;
  resetConfig();
  generateConfig();

  createDialogVisible.value = false;
  ElMessage.success("新配置已创建");
};

const showTemplateManager = () => {
  templateDialogVisible.value = true;
};

const saveAsTemplate = () => {
  if (!generatedConfig.value || !selectedType.value) {
    ElMessage.warning("请先生成配置");
    return;
  }

  ElMessageBox.prompt("请输入模板名称", "保存模板", {
    confirmButtonText: "保存",
    cancelButtonText: "取消",
    inputPattern: /.+/,
    inputErrorMessage: "模板名称不能为空",
  })
    .then(({ value }) => {
      const template: ConfigTemplate = {
        name: value,
        assistantType: selectedType.value,
        description: newConfigForm.description || "",
        config: { ...configForm },
        createdAt: new Date(),
      };

      configTemplates.value.push(template);
      ElMessage.success("模板已保存");
    })
    .catch(() => {
      // 用户取消
    });
};

const useConfigTemplate = (template: ConfigTemplate) => {
  Object.assign(configForm, template.config);
  selectedType.value = template.assistantType;
  generateConfig();
  templateDialogVisible.value = false;
  ElMessage.success("模板已应用");
};

const editTemplate = (template: ConfigTemplate) => {
  ElMessage.info("编辑功能开发中...");
};

const deleteTemplate = async (index: number) => {
  try {
    await ElMessageBox.confirm("确定要删除这个模板吗？", "确认删除", {
      confirmButtonText: "删除",
      cancelButtonText: "取消",
      type: "warning",
    });

    configTemplates.value.splice(index, 1);
    ElMessage.success("模板已删除");
  } catch {
    // 用户取消
  }
};

const importTemplate = () => {
  ElMessage.info("导入功能开发中...");
};

const importConfig = () => {
  ElMessage.info("导入功能开发中...");
};

const useTemplate = () => {
  if (configTemplates.value.length === 0) {
    ElMessage.warning("暂无可用模板");
    return;
  }

  showTemplateManager();
};

// 监听器
watch(
  configForm,
  () => {
    generateConfig();
  },
  { deep: true },
);

watch(generatedConfig, () => {
  if (generatedConfig.value) {
    saveToHistory();
  }
});

// 生命周期
onMounted(() => {
  // 加载保存的配置和模板
  const savedHistory = localStorage.getItem("ai-assistant-config-history");
  if (savedHistory) {
    try {
      const parsed = JSON.parse(savedHistory);
      configHistory.value = parsed.map((item: any) => ({
        ...item,
        createdAt: new Date(item.createdAt),
      }));
    } catch {
      // 忽略解析错误
    }
  }

  const savedTemplates = localStorage.getItem("ai-assistant-config-templates");
  if (savedTemplates) {
    try {
      const parsed = JSON.parse(savedTemplates);
      configTemplates.value = parsed.map((item: any) => ({
        ...item,
        createdAt: new Date(item.createdAt),
      }));
    } catch {
      // 忽略解析错误
    }
  }

  // 更新助手配置数量
  assistantTypes.value.forEach((assistant) => {
    assistant.configCount = configHistory.value.filter(
      (item) => item.assistantType === assistant.type,
    ).length;
  });
});

// 保存数据到localStorage
watch(
  configHistory,
  () => {
    localStorage.setItem(
      "ai-assistant-config-history",
      JSON.stringify(configHistory.value),
    );
  },
  { deep: true },
);

watch(
  configTemplates,
  () => {
    localStorage.setItem(
      "ai-assistant-config-templates",
      JSON.stringify(configTemplates.value),
    );
  },
  { deep: true },
);
</script>

<style scoped>
.ai-assistant {
  padding: 20px;
  min-height: 100vh;
  background: var(--el-bg-color-page);
}

.header-section {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
  padding: 24px;
  background: var(--el-bg-color);
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.header-content h1 {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0 0 8px 0;
  font-size: 28px;
  color: var(--el-text-color-primary);
}

.header-description {
  margin: 0;
  color: var(--el-text-color-secondary);
  font-size: 14px;
}

.header-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.assistant-types-section {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.assistant-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 16px;
}

.assistant-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  border: 2px solid var(--el-border-color-light);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  background: var(--el-bg-color);
}

.assistant-card:hover {
  border-color: var(--el-color-primary);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.assistant-card.active {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

.assistant-icon {
  flex-shrink: 0;
}

.assistant-info {
  flex: 1;
}

.assistant-info h3 {
  margin: 0 0 8px 0;
  font-size: 18px;
  color: var(--el-text-color-primary);
}

.assistant-info p {
  margin: 0 0 12px 0;
  color: var(--el-text-color-secondary);
  font-size: 14px;
  line-height: 1.5;
}

.assistant-features {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.assistant-status {
  flex-shrink: 0;
}

.config-badge {
  cursor: default;
}

.config-section {
  margin-bottom: 20px;
}

.form-hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 4px;
}

.format-tabs {
  margin-bottom: 16px;
}

.config-editor {
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  overflow: hidden;
}

.config-preview {
  background: var(--el-fill-color-darker);
  color: var(--el-text-color-primary);
  padding: 16px;
  margin: 0;
  white-space: pre-wrap;
  word-wrap: break-word;
  max-height: 400px;
  overflow-y: auto;
  font-family: "Consolas", "Monaco", "Courier New", monospace;
  font-size: 13px;
  line-height: 1.5;
}

.validation-result {
  margin-top: 16px;
}

.history-section {
  margin-bottom: 20px;
}

.empty-history {
  padding: 40px;
  text-align: center;
}

.history-list {
  max-height: 400px;
  overflow-y: auto;
}

.history-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.history-item:last-child {
  border-bottom: none;
}

.history-info {
  flex: 1;
}

.history-name {
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin-bottom: 4px;
}

.history-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.history-time {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.history-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.template-manager {
  padding: 16px 0;
}

.template-actions {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

/* 响应式设计 */
@media (max-width: 1200px) {
  .header-section {
    flex-direction: column;
    gap: 16px;
    align-items: stretch;
  }

  .assistant-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .ai-assistant {
    padding: 12px;
  }

  .assistant-card {
    flex-direction: column;
    text-align: center;
  }

  .config-section .el-col {
    margin-bottom: 20px;
  }

  .history-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .history-actions {
    align-self: stretch;
    justify-content: flex-end;
  }
}
</style>
