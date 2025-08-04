<template>
  <div class="config-manager">
    <!-- 页面头部 -->
    <div class="page-header">
      <h2>配置管理</h2>
      <div class="header-actions">
        <el-button type="primary" @click="showExportDialog" :icon="Download">
          导出配置
        </el-button>
        <el-button type="success" @click="showImportDialog" :icon="Upload">
          导入配置
        </el-button>
        <el-button @click="refreshData" :icon="Refresh" :loading="loading">
          刷新
        </el-button>
      </div>
    </div>

    <!-- 主要内容区域 -->
    <el-tabs v-model="activeTab" class="config-tabs">
      <!-- 配置管理标签页 -->
      <el-tab-pane label="配置管理" name="config">
        <div class="config-content">
          <!-- 配置概览卡片 -->
          <el-card shadow="never" class="overview-card">
            <template #header>
              <div class="card-header">
                <span>配置概览</span>
                <div class="header-actions">
                  <el-select
                    v-model="selectedConfigType"
                    placeholder="筛选配置类型"
                    clearable
                    style="width: 180px"
                  >
                    <el-option label="服务器配置" value="servers" />
                    <el-option label="认证配置" value="auth" />
                    <el-option label="OpenAPI规范" value="openapi" />
                    <el-option label="测试用例" value="testcases" />
                    <el-option label="系统设置" value="settings" />
                  </el-select>
                </div>
              </div>
            </template>

            <div class="config-grid" v-loading="loading">
              <div
                v-for="config in filteredConfigs"
                :key="config.type"
                class="config-card"
              >
                <div class="config-header">
                  <div class="config-title">
                    <el-icon
                      class="config-icon"
                      :class="getConfigIcon(config.type)"
                    >
                      <Setting />
                    </el-icon>
                    <span>{{ getConfigLabel(config.type) }}</span>
                  </div>
                  <el-tag :type="getConfigStatus(config)" size="small">
                    {{ config.count }} 项
                  </el-tag>
                </div>

                <div class="config-details">
                  <div class="detail-row">
                    <span class="label">最后更新:</span>
                    <span class="value">{{
                      formatDateTime(config.lastUpdated)
                    }}</span>
                  </div>
                  <div class="detail-row">
                    <span class="label">大小:</span>
                    <span class="value">{{ formatFileSize(config.size) }}</span>
                  </div>
                </div>

                <div class="config-actions">
                  <el-button
                    size="small"
                    @click="previewConfig(config.type)"
                    :icon="View"
                  >
                    预览
                  </el-button>
                  <el-button
                    size="small"
                    @click="exportSingleConfig(config.type)"
                    :icon="Download"
                  >
                    导出
                  </el-button>
                </div>
              </div>
            </div>
          </el-card>

          <!-- 操作历史卡片 -->
          <el-card shadow="never" class="history-card">
            <template #header>
              <span>最近操作记录</span>
            </template>

            <div v-if="operationHistory.length === 0" class="empty-history">
              <el-empty description="暂无操作记录" />
            </div>

            <el-timeline v-else>
              <el-timeline-item
                v-for="item in operationHistory.slice(0, 5)"
                :key="item.id"
                :type="item.status === 'success' ? 'success' : 'danger'"
                :timestamp="formatDateTime(item.timestamp)"
              >
                <div class="history-item">
                  <h4>{{ item.description }}</h4>
                  <p>{{ item.details }}</p>
                  <el-button
                    link
                    type="primary"
                    size="small"
                    @click="showHistoryDetails(item)"
                  >
                    查看详情
                  </el-button>
                </div>
              </el-timeline-item>
            </el-timeline>
          </el-card>
        </div>
      </el-tab-pane>

      <!-- 备份管理标签页 -->
      <el-tab-pane label="备份管理" name="backup">
        <BackupManager />
      </el-tab-pane>
    </el-tabs>

    <!-- 其他对话框和组件保持不变... -->
    <!-- 导出配置对话框 -->
    <el-dialog v-model="exportDialogVisible" title="导出配置" width="600px">
      <el-form ref="exportFormRef" :model="exportForm" label-width="120px">
        <el-form-item label="导出类型">
          <el-checkbox-group v-model="exportForm.types">
            <el-checkbox label="servers">服务器配置</el-checkbox>
            <el-checkbox label="auth">认证配置</el-checkbox>
            <el-checkbox label="openapi">OpenAPI规范</el-checkbox>
            <el-checkbox label="testcases">测试用例</el-checkbox>
            <el-checkbox label="settings">系统设置</el-checkbox>
          </el-checkbox-group>
        </el-form-item>

        <el-form-item label="导出格式">
          <el-radio-group v-model="exportForm.format">
            <el-radio label="json">JSON</el-radio>
            <el-radio label="yaml">YAML</el-radio>
            <el-radio label="zip">ZIP压缩包</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="敏感数据">
          <el-radio-group v-model="exportForm.sensitiveData">
            <el-radio label="exclude">排除敏感信息</el-radio>
            <el-radio label="encrypt">加密敏感信息</el-radio>
            <el-radio label="include">包含敏感信息</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item
          v-if="exportForm.sensitiveData === 'encrypt'"
          label="加密密码"
        >
          <el-input
            v-model="exportForm.password"
            type="password"
            show-password
            placeholder="请输入加密密码"
          />
        </el-form-item>

        <el-form-item label="备注">
          <el-input
            v-model="exportForm.notes"
            type="textarea"
            :rows="3"
            placeholder="可选：添加导出说明"
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="exportDialogVisible = false">取消</el-button>
        <el-button
          type="primary"
          @click="executeExport"
          :loading="configStore.loading"
        >
          导出配置
        </el-button>
      </template>
    </el-dialog>

    <!-- 导入配置对话框 -->
    <el-dialog
      v-model="importDialogVisible"
      title="导入配置"
      width="800px"
      :close-on-click-modal="false"
    >
      <!-- 导入步骤指示器 -->
      <el-steps
        :active="importStep"
        finish-status="success"
        class="import-steps"
      >
        <el-step title="选择文件" />
        <el-step title="验证配置" />
        <el-step title="解决冲突" />
        <el-step title="导入完成" />
      </el-steps>

      <!-- 步骤1: 文件选择 -->
      <div v-if="importStep === 0" class="import-step">
        <div class="upload-section">
          <el-upload
            ref="uploadRef"
            drag
            :auto-upload="false"
            :on-change="handleFileUpload"
            :show-file-list="false"
            accept=".json,.yaml,.yml,.zip"
          >
            <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
            <div class="el-upload__text">
              将配置文件拖拽到此处，或<em>点击选择文件</em>
            </div>
            <template #tip>
              <div class="el-upload__tip">
                支持 JSON、YAML、ZIP 格式的配置文件
              </div>
            </template>
          </el-upload>
        </div>

        <div v-if="importForm.file" class="file-info">
          <h4>已选择文件</h4>
          <div class="file-details">
            <div class="detail-item">
              <span class="label">文件名:</span>
              <span class="value">{{ importForm.file.name }}</span>
            </div>
            <div class="detail-item">
              <span class="label">文件大小:</span>
              <span class="value">{{
                formatFileSize(importForm.file.size)
              }}</span>
            </div>
            <div class="detail-item">
              <span class="label">文件类型:</span>
              <span class="value">{{ getFileType(importForm.file.name) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 步骤2: 配置验证 -->
      <div v-if="importStep === 1" class="import-step">
        <div class="validation-result" v-loading="configStore.loading">
          <div v-if="validationResult">
            <div class="validation-summary">
              <div
                class="summary-item"
                :class="validationResult.valid ? 'success' : 'error'"
              >
                <el-icon
                  ><Check v-if="validationResult.valid" /><Close v-else
                /></el-icon>
                <span
                  >配置验证{{ validationResult.valid ? "成功" : "失败" }}</span
                >
              </div>
            </div>

            <div class="validation-details">
              <el-collapse>
                <el-collapse-item title="配置内容概览" name="1">
                  <div class="config-overview">
                    <div
                      v-for="(count, type) in validationResult.configCounts"
                      :key="type"
                      class="config-count-item"
                    >
                      <span class="type-label">{{ getConfigLabel(type) }}</span>
                      <span class="count-value">{{ count }} 项</span>
                    </div>
                  </div>
                </el-collapse-item>

                <el-collapse-item
                  v-if="validationResult.errors.length > 0"
                  title="验证错误"
                  name="2"
                >
                  <div class="validation-errors">
                    <div
                      v-for="error in validationResult.errors"
                      :key="error.id"
                      class="error-item"
                    >
                      <el-text type="danger">{{ error.message }}</el-text>
                      <div class="error-details">{{ error.details }}</div>
                    </div>
                  </div>
                </el-collapse-item>

                <el-collapse-item
                  v-if="validationResult.warnings.length > 0"
                  title="验证警告"
                  name="3"
                >
                  <div class="validation-warnings">
                    <div
                      v-for="warning in validationResult.warnings"
                      :key="warning.id"
                      class="warning-item"
                    >
                      <el-text type="warning">{{ warning.message }}</el-text>
                      <div class="warning-details">{{ warning.details }}</div>
                    </div>
                  </div>
                </el-collapse-item>
              </el-collapse>
            </div>
          </div>
        </div>
      </div>

      <!-- 步骤3: 冲突解决 -->
      <div v-if="importStep === 2" class="import-step">
        <div v-if="conflicts.length > 0" class="conflicts-section">
          <h4>检测到配置冲突</h4>
          <p class="conflicts-description">
            以下配置项与现有配置存在冲突，请选择处理方式：
          </p>

          <div class="conflicts-list">
            <div
              v-for="conflict in conflicts"
              :key="conflict.id"
              class="conflict-item"
            >
              <div class="conflict-header">
                <h5>{{ conflict.title }}</h5>
                <el-tag size="small">{{
                  getConfigLabel(conflict.type)
                }}</el-tag>
              </div>

              <div class="conflict-content">
                <div class="conflict-side">
                  <h6>当前配置</h6>
                  <pre>{{ JSON.stringify(conflict.current, null, 2) }}</pre>
                </div>
                <div class="conflict-side">
                  <h6>导入配置</h6>
                  <pre>{{ JSON.stringify(conflict.incoming, null, 2) }}</pre>
                </div>
              </div>

              <div class="conflict-resolution">
                <el-radio-group v-model="conflict.resolution">
                  <el-radio label="keep">保留当前配置</el-radio>
                  <el-radio label="replace">使用导入配置</el-radio>
                  <el-radio label="merge">合并配置</el-radio>
                </el-radio-group>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="no-conflicts">
          <el-result
            icon="success"
            title="没有发现冲突"
            sub-title="可以直接导入配置"
          >
          </el-result>
        </div>
      </div>

      <!-- 步骤4: 导入结果 -->
      <div v-if="importStep === 3" class="import-step">
        <div v-if="importing" class="importing-progress">
          <el-progress :percentage="80" :show-text="false" />
          <p>正在导入配置，请稍候...</p>
        </div>

        <div v-if="!configStore.loading && importResult">
          <el-result
            :icon="importResult.success ? 'success' : 'error'"
            :title="importResult.success ? '导入成功' : '导入失败'"
            :sub-title="importResult.message"
          >
            <template #extra>
              <div class="import-summary">
                <div v-if="importResult.success" class="success-details">
                  <h4>导入统计</h4>
                  <div
                    v-for="(count, type) in importResult.appliedCounts"
                    :key="type"
                    class="count-item"
                  >
                    <span>{{ getConfigLabel(type) }}: {{ count }}项</span>
                  </div>
                </div>
                <div v-else class="error-details">
                  <div class="error-message">{{ importResult.error }}</div>
                </div>
              </div>
            </template>
          </el-result>
        </div>
      </div>

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="cancelImport">取消</el-button>
          <el-button v-if="importStep > 0" @click="prevStep">
            上一步
          </el-button>
          <el-button
            v-if="importStep < 3"
            type="primary"
            @click="nextStep"
            :disabled="!canProceed"
            :loading="configStore.loading || importing"
          >
            {{ getNextStepText() }}
          </el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 配置预览对话框 -->
    <el-dialog
      v-model="previewDialogVisible"
      :title="`${getConfigLabel(previewConfigType)} 预览`"
      width="800px"
    >
      <div class="preview-content">
        <div class="preview-toolbar">
          <el-radio-group v-model="previewFormat" size="small">
            <el-radio-button label="json">JSON</el-radio-button>
            <el-radio-button label="yaml">YAML</el-radio-button>
          </el-radio-group>
          <el-button
            size="small"
            :icon="CopyDocument"
            @click="copyPreviewContent"
          >
            复制
          </el-button>
        </div>
        <div class="preview-body">
          <pre>{{ previewContent[previewFormat] }}</pre>
        </div>
      </div>
    </el-dialog>

    <!-- 操作历史详情对话框 -->
    <el-dialog v-model="historyDetailsVisible" title="操作详情" width="600px">
      <div v-if="selectedHistoryItem" class="history-details">
        <div class="basic-info">
          <h4>基本信息</h4>
          <div class="info-grid">
            <div class="info-item">
              <span class="label">操作类型:</span>
              <span class="value">{{ selectedHistoryItem.description }}</span>
            </div>
            <div class="info-item">
              <span class="label">执行时间:</span>
              <span class="value">{{
                formatDateTime(selectedHistoryItem.timestamp)
              }}</span>
            </div>
            <div class="info-item">
              <span class="label">操作状态:</span>
              <span
                class="value"
                :class="
                  selectedHistoryItem.status === 'success' ? 'success' : 'error'
                "
              >
                {{ selectedHistoryItem.status === "success" ? "成功" : "失败" }}
              </span>
            </div>
          </div>
        </div>

        <div class="detail-section" v-if="selectedHistoryItem.metadata">
          <h4>详细信息</h4>
          <pre>{{ JSON.stringify(selectedHistoryItem.metadata, null, 2) }}</pre>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import {
  ElMessage,
  ElMessageBox,
  type FormInstance,
  type UploadInstance,
  type UploadFile,
} from "element-plus";
import {
  Setting,
  Download,
  Upload,
  Refresh,
  View,
  Check,
  Close,
  UploadFilled,
  CopyDocument,
} from "@element-plus/icons-vue";

// 引入stores
import { useAppStore } from "@/stores/app";
import {
  useConfigStore,
  type ConfigExportOptions,
  type ConfigValidationResult,
  type ConfigConflict,
} from "@/stores/config";

// 引入组件
import BackupManager from "./components/BackupManager.vue";

// Types
interface ConfigItem {
  type: string;
  count: number;
  lastUpdated: Date;
  size: number;
  valid: boolean;
}

interface OperationHistory {
  id: string;
  type: "import" | "export" | "backup" | "restore";
  timestamp: Date;
  status: "success" | "failed";
  description: string;
  details: string;
  metadata?: any;
}

interface ImportForm {
  file: File | null;
}

interface ImportResult {
  success: boolean;
  message: string;
  appliedCounts?: Record<string, number>;
  error?: string;
}

// Stores
const appStore = useAppStore();
const configStore = useConfigStore();

// Reactive data
const loading = ref(false);
const selectedConfigType = ref("");
const activeTab = ref("config");

// 对话框状态
const exportDialogVisible = ref(false);
const importDialogVisible = ref(false);
const previewDialogVisible = ref(false);
const historyDetailsVisible = ref(false);

// 表单数据
const exportFormRef = ref<FormInstance>();
const uploadRef = ref<UploadInstance>();
const exportForm = ref<ConfigExportOptions>({
  types: ["servers", "auth", "openapi", "testcases", "settings"],
  format: "json",
  sensitiveData: "exclude",
  password: "",
  notes: "",
});

const importForm = ref<ImportForm>({
  file: null,
});

// 导入流程状态
const importStep = ref(0);
const importing = ref(false);
const validationResult = ref<ConfigValidationResult | null>(null);
const conflicts = ref<ConfigConflict[]>([]);
const importResult = ref<ImportResult | null>(null);

// 预览相关
const previewConfigType = ref("");
const previewFormat = ref<"json" | "yaml">("json");
const previewContent = ref({ json: "", yaml: "" });

// 历史记录
const operationHistory = ref<OperationHistory[]>([]);
const selectedHistoryItem = ref<OperationHistory | null>(null);

// 模拟配置数据
const configItems = ref<ConfigItem[]>([
  {
    type: "servers",
    count: 3,
    lastUpdated: new Date(Date.now() - 2 * 60 * 60 * 1000),
    size: 2048,
    valid: true,
  },
  {
    type: "auth",
    count: 2,
    lastUpdated: new Date(Date.now() - 1 * 60 * 60 * 1000),
    size: 512,
    valid: true,
  },
  {
    type: "openapi",
    count: 5,
    lastUpdated: new Date(Date.now() - 30 * 60 * 1000),
    size: 15360,
    valid: true,
  },
  {
    type: "testcases",
    count: 12,
    lastUpdated: new Date(Date.now() - 10 * 60 * 1000),
    size: 8192,
    valid: true,
  },
  {
    type: "settings",
    count: 1,
    lastUpdated: new Date(Date.now() - 5 * 60 * 1000),
    size: 256,
    valid: true,
  },
]);

// Computed properties
const filteredConfigs = computed(() => {
  if (!selectedConfigType.value) return configItems.value;
  return configItems.value.filter(
    (config) => config.type === selectedConfigType.value,
  );
});

const canProceed = computed(() => {
  switch (importStep.value) {
    case 0:
      return importForm.value.file !== null;
    case 1:
      return validationResult.value?.valid === true;
    case 2:
      return true; // 冲突解决步骤总是可以继续
    case 3:
      return false; // 最后一步不需要继续按钮
    default:
      return false;
  }
});

// Methods
const showExportDialog = () => {
  exportDialogVisible.value = true;
};

const showImportDialog = () => {
  importStep.value = 0;
  importForm.value.file = null;
  validationResult.value = null;
  conflicts.value = [];
  importResult.value = null;
  importDialogVisible.value = true;
};

const refreshData = async () => {
  loading.value = true;
  try {
    // 模拟数据刷新
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 更新配置项的时间戳
    configItems.value.forEach((config) => {
      config.lastUpdated = new Date(
        Date.now() - Math.random() * 60 * 60 * 1000,
      );
    });

    ElMessage.success("数据刷新成功");
  } catch (error) {
    ElMessage.error("数据刷新失败");
  } finally {
    loading.value = false;
  }
};

const getConfigIcon = (type: string): string => {
  const icons: Record<string, string> = {
    servers: "el-icon-server",
    auth: "el-icon-lock",
    openapi: "el-icon-document",
    testcases: "el-icon-data-analysis",
    settings: "el-icon-setting",
  };
  return icons[type] || "el-icon-files";
};

const getConfigLabel = (type: string): string => {
  const labels: Record<string, string> = {
    servers: "服务器配置",
    auth: "认证配置",
    openapi: "OpenAPI规范",
    testcases: "测试用例",
    settings: "系统设置",
  };
  return labels[type] || type;
};

const getConfigStatus = (config: ConfigItem): string => {
  if (!config.valid) return "danger";
  if (config.count === 0) return "info";
  return "success";
};

const formatDateTime = (date: Date): string => {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(date));
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

const getFileType = (filename: string): string => {
  const ext = filename.split(".").pop()?.toLowerCase();
  const types: Record<string, string> = {
    json: "JSON配置文件",
    yaml: "YAML配置文件",
    yml: "YAML配置文件",
    zip: "ZIP压缩包",
  };
  return types[ext || ""] || "未知格式";
};

const previewConfig = async (type: string) => {
  previewConfigType.value = type;

  // 模拟获取配置数据
  const mockConfig = generateMockConfig(type);
  previewContent.value = {
    json: JSON.stringify(mockConfig, null, 2),
    yaml: convertToYaml(mockConfig),
  };

  previewDialogVisible.value = true;
};

const exportSingleConfig = async (type: string) => {
  try {
    const config = generateMockConfig(type);
    const filename = `${type}-config-${Date.now()}.json`;
    downloadFile(JSON.stringify(config, null, 2), filename, "application/json");

    addOperationHistory(
      "export",
      `导出${getConfigLabel(type)}`,
      `已导出 ${filename}`,
      true,
      { type, filename },
    );
    ElMessage.success("配置导出成功");
  } catch (error) {
    ElMessage.error("配置导出失败");
  }
};

const executeExport = async () => {
  if (exportForm.value.types.length === 0) {
    ElMessage.warning("请选择要导出的配置类型");
    return;
  }

  const success = await configStore.exportConfig(exportForm.value);

  if (success) {
    addOperationHistory(
      "export",
      "导出配置",
      `已导出 ${exportForm.value.types.length} 种配置类型`,
      true,
      { types: exportForm.value.types, format: exportForm.value.format },
    );
    exportDialogVisible.value = false;
  }
};

const handleFileUpload = async (file: UploadFile) => {
  if (file.raw) {
    importForm.value.file = file.raw;

    // 自动进行验证
    validationResult.value = await configStore.validateImportConfig(file.raw);

    if (validationResult.value?.valid) {
      // 检测冲突
      try {
        const content = await readFileContent(file.raw);
        const parsedConfig = parseConfigFile(content, file.raw.name);
        conflicts.value = await configStore.detectConflicts(parsedConfig);
      } catch (error) {
        console.error("冲突检测失败:", error);
      }
    }
  }
};

const nextStep = async () => {
  switch (importStep.value) {
    case 0:
      if (importForm.value.file) {
        importStep.value = 1;
        await validateConfig();
      }
      break;
    case 1:
      if (validationResult.value?.valid) {
        importStep.value = 2;
        await detectConflicts();
      }
      break;
    case 2:
      importStep.value = 3;
      await applyConfig();
      break;
  }
};

const prevStep = () => {
  if (importStep.value > 0) {
    importStep.value--;
  }
};

const validateConfig = async () => {
  if (!importForm.value.file) return;

  validationResult.value = await configStore.validateImportConfig(
    importForm.value.file,
  );
};

const detectConflicts = async () => {
  if (!importForm.value.file) return;

  try {
    const fileContent = await readFileContent(importForm.value.file);
    const parsedConfig = parseConfigFile(
      fileContent,
      importForm.value.file.name,
    );
    conflicts.value = await configStore.detectConflicts(parsedConfig);
  } catch (error) {
    console.error("冲突检测失败:", error);
    ElMessage.error("冲突检测失败");
  }
};

const applyConfig = async () => {
  importing.value = true;
  try {
    if (!importForm.value.file) {
      throw new Error("没有选择文件");
    }

    const fileContent = await readFileContent(importForm.value.file);
    const parsedConfig = parseConfigFile(
      fileContent,
      importForm.value.file.name,
    );

    const result = await configStore.applyImportConfig(
      parsedConfig,
      conflicts.value,
    );

    if (result.success) {
      importResult.value = result;

      addOperationHistory(
        "import",
        "导入配置",
        `成功导入 ${importForm.value.file.name}`,
        true,
        {
          filename: importForm.value.file.name,
          conflicts: conflicts.value.length,
        },
      );
    } else {
      importResult.value = {
        success: false,
        message: result.message,
        error: result.errors?.[0] || "导入失败",
      };
    }
  } catch (error) {
    importResult.value = {
      success: false,
      message: "配置导入失败",
      error: error instanceof Error ? error.message : "未知错误",
    };

    addOperationHistory(
      "import",
      "导入配置",
      `导入失败: ${importForm.value.file?.name}`,
      false,
      {
        filename: importForm.value.file?.name,
        error: error instanceof Error ? error.message : "未知错误",
      },
    );

    ElMessage.error("配置导入失败");
  } finally {
    importing.value = false;
  }
};

const cancelImport = () => {
  importDialogVisible.value = false;
  importStep.value = 0;
  importForm.value.file = null;
};

const getNextStepText = (): string => {
  switch (importStep.value) {
    case 0:
      return "验证配置";
    case 1:
      return "检测冲突";
    case 2:
      return "开始导入";
    default:
      return "下一步";
  }
};

const copyPreviewContent = () => {
  navigator.clipboard.writeText(previewContent.value[previewFormat.value]);
  ElMessage.success("已复制到剪贴板");
};

const showHistoryDetails = (item: OperationHistory) => {
  selectedHistoryItem.value = item;
  historyDetailsVisible.value = true;
};

const addOperationHistory = (
  type: "import" | "export" | "backup" | "restore",
  description: string,
  details: string,
  success: boolean,
  metadata?: any,
) => {
  const record: OperationHistory = {
    id: `operation_${Date.now()}`,
    type,
    timestamp: new Date(),
    status: success ? "success" : "failed",
    description,
    details,
    metadata,
  };

  operationHistory.value.unshift(record);

  // 保留最近50条记录
  if (operationHistory.value.length > 50) {
    operationHistory.value = operationHistory.value.slice(0, 50);
  }
};

// Helper functions
const generateMockConfig = (type: string): any => {
  const mockConfigs: Record<string, any> = {
    servers: [
      {
        id: "1",
        name: "API Server",
        host: "localhost",
        port: 3000,
        protocol: "http",
      },
      {
        id: "2",
        name: "Database Server",
        host: "db.example.com",
        port: 5432,
        protocol: "tcp",
      },
    ],
    auth: [
      {
        id: "1",
        type: "bearer",
        name: "API Token",
        description: "Bearer token authentication",
      },
      {
        id: "2",
        type: "basic",
        name: "Basic Auth",
        description: "Username/password authentication",
      },
    ],
    openapi: [
      { id: "1", name: "User API", version: "1.0.0", path: "/api/v1/users" },
      {
        id: "2",
        name: "Product API",
        version: "2.0.0",
        path: "/api/v2/products",
      },
    ],
    testcases: [
      { id: "1", name: "Login Test", type: "auth", status: "passing" },
      { id: "2", name: "CRUD Test", type: "api", status: "passing" },
    ],
    settings: {
      theme: "light",
      language: "zh-CN",
      notifications: true,
      autoSave: true,
    },
  };

  return mockConfigs[type] || {};
};

const convertToYaml = (obj: any): string => {
  // 简单的YAML转换（实际项目中应使用专门的库）
  return JSON.stringify(obj, null, 2).replace(/"/g, "").replace(/,$/gm, "");
};

const downloadFile = (
  content: string,
  filename: string,
  mimeType: string,
): void => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const readFileContent = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = () => reject(new Error("文件读取失败"));
    reader.readAsText(file);
  });
};

const parseConfigFile = (content: string, filename: string): any => {
  const ext = filename.split(".").pop()?.toLowerCase();

  if (ext === "json") {
    return JSON.parse(content);
  } else if (ext === "yaml" || ext === "yml") {
    // 实际项目中应使用yaml解析库
    return JSON.parse(content); // 临时实现
  } else {
    throw new Error("不支持的文件格式");
  }
};

onMounted(() => {
  // 初始化一些示例操作历史
  addOperationHistory(
    "export",
    "导出服务器配置",
    "成功导出3个服务器配置",
    true,
    { type: "servers", count: 3 },
  );
  addOperationHistory("import", "导入认证配置", "成功导入2个认证配置", true, {
    type: "auth",
    count: 2,
  });
});
</script>

<style scoped>
.config-manager {
  padding: 20px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--el-border-color);
}

.page-header h2 {
  margin: 0;
  color: var(--el-text-color-primary);
}

.header-actions {
  display: flex;
  gap: 12px;
}

.config-tabs {
  margin-top: 20px;
}

.config-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.overview-card {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.config-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}

.config-card {
  padding: 20px;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  background: var(--el-bg-color);
  transition: all 0.3s ease;
}

.config-card:hover {
  border-color: var(--el-color-primary);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.config-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.config-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.config-icon {
  color: var(--el-color-primary);
}

.config-details {
  margin-bottom: 16px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
  font-size: 13px;
}

.detail-row .label {
  color: var(--el-text-color-secondary);
}

.detail-row .value {
  color: var(--el-text-color-primary);
}

.config-actions {
  display: flex;
  gap: 8px;
}

.history-card {
  margin-top: 20px;
}

.empty-history {
  text-align: center;
  padding: 40px;
}

.history-item h4 {
  margin: 0 0 8px 0;
  color: var(--el-text-color-primary);
}

.history-item p {
  margin: 0 0 8px 0;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.import-steps {
  margin-bottom: 30px;
}

.import-step {
  min-height: 300px;
  padding: 20px 0;
}

.upload-section {
  margin-bottom: 20px;
}

.file-info {
  padding: 20px;
  background: var(--el-bg-color-page);
  border-radius: 8px;
}

.file-details {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.detail-item {
  display: flex;
  justify-content: space-between;
}

.detail-item .label {
  color: var(--el-text-color-secondary);
  font-weight: 500;
}

.detail-item .value {
  color: var(--el-text-color-primary);
}

.validation-result {
  min-height: 200px;
}

.validation-summary {
  margin-bottom: 20px;
}

.summary-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  border-radius: 6px;
  font-weight: 500;
}

.summary-item.success {
  background: var(--el-color-success-light-9);
  color: var(--el-color-success);
}

.summary-item.error {
  background: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
}

.config-overview {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.config-count-item {
  display: flex;
  justify-content: space-between;
  padding: 12px;
  background: var(--el-bg-color-page);
  border-radius: 6px;
}

.type-label {
  color: var(--el-text-color-primary);
  font-weight: 500;
}

.count-value {
  color: var(--el-color-primary);
  font-weight: 600;
}

.error-item,
.warning-item {
  padding: 12px;
  margin-bottom: 8px;
  border-radius: 6px;
}

.error-item {
  background: var(--el-color-danger-light-9);
}

.warning-item {
  background: var(--el-color-warning-light-9);
}

.error-details,
.warning-details {
  margin-top: 4px;
  font-size: 12px;
  opacity: 0.8;
}

.conflicts-section {
  padding: 20px 0;
}

.conflicts-description {
  color: var(--el-text-color-secondary);
  margin-bottom: 20px;
}

.conflict-item {
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  margin-bottom: 16px;
  overflow: hidden;
}

.conflict-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: var(--el-bg-color-page);
  border-bottom: 1px solid var(--el-border-color);
}

.conflict-header h5 {
  margin: 0;
  color: var(--el-text-color-primary);
}

.conflict-content {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1px;
  background: var(--el-border-color);
}

.conflict-side {
  padding: 16px;
  background: var(--el-bg-color);
}

.conflict-side h6 {
  margin: 0 0 8px 0;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  text-transform: uppercase;
}

.conflict-side pre {
  margin: 0;
  font-size: 12px;
  background: var(--el-bg-color-page);
  padding: 8px;
  border-radius: 4px;
  overflow-x: auto;
}

.conflict-resolution {
  padding: 16px;
  background: var(--el-bg-color);
}

.no-conflicts {
  text-align: center;
  padding: 40px;
}

.importing-progress {
  text-align: center;
  padding: 40px;
}

.importing-progress p {
  margin-top: 16px;
  color: var(--el-text-color-secondary);
}

.import-summary {
  text-align: left;
}

.success-details h4 {
  margin: 0 0 12px 0;
  color: var(--el-text-color-primary);
}

.count-item {
  margin-bottom: 4px;
  color: var(--el-text-color-secondary);
}

.error-message {
  color: var(--el-color-danger);
  font-weight: 500;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.preview-content {
  max-height: 500px;
  overflow: hidden;
}

.preview-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--el-border-color);
}

.preview-body {
  max-height: 450px;
  overflow: auto;
}

.preview-body pre {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
}

.history-details {
  padding: 20px 0;
}

.basic-info h4 {
  margin: 0 0 16px 0;
  color: var(--el-text-color-primary);
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.info-item .label {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  text-transform: uppercase;
}

.info-item .value {
  color: var(--el-text-color-primary);
  font-weight: 500;
}

.info-item .value.success {
  color: var(--el-color-success);
}

.info-item .value.error {
  color: var(--el-color-danger);
}

.detail-section {
  margin-top: 20px;
}

.detail-section h4 {
  margin: 0 0 12px 0;
  color: var(--el-text-color-primary);
}

.detail-section pre {
  background: var(--el-bg-color-page);
  padding: 16px;
  border-radius: 6px;
  font-size: 12px;
  overflow-x: auto;
}
</style>
