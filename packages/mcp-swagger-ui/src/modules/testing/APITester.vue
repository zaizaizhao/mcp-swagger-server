<template>
  <div class="api-tester">
    <!-- 页面头部 -->
    <div class="header-section">
      <div class="header-content">
        <h1>
          <el-icon><Tools /></el-icon>
          API测试工具
        </h1>
        <p class="header-description">
          测试转换后的MCP工具，验证API调用和参数配置
        </p>
      </div>

      <div class="header-actions">
        <el-button
          type="primary"
          :icon="Plus"
          @click="showCreateTestCaseDialog"
          :disabled="!selectedTool"
        >
          创建测试用例
        </el-button>
        <el-button :icon="Refresh" @click="refreshData" :loading="loading">
          刷新
        </el-button>
      </div>
    </div>

    <!-- 主要内容区域 -->
    <div class="main-content">
      <!-- 左侧工具列表 -->
      <div class="tools-panel">
        <div class="panel-header">
          <h3>可用工具</h3>
          <el-input
            v-model="toolSearchText"
            placeholder="搜索工具..."
            :prefix-icon="Search"
            clearable
            size="small"
          />
        </div>

        <div class="tools-list" v-loading="loadingTools">
          <div
            v-for="tool in filteredTools"
            :key="tool.id"
            class="tool-item"
            :class="{ active: selectedTool?.id === tool.id }"
            @click="selectTool(tool)"
          >
            <div class="tool-info">
              <div class="tool-name">{{ tool.name }}</div>
              <div class="tool-method">{{ tool.method.toUpperCase() }}</div>
            </div>
            <div class="tool-description">{{ tool.description }}</div>
          </div>

          <div v-if="filteredTools.length === 0" class="empty-state">
            <el-empty description="暂无可用工具">
              <el-button type="primary" @click="$router.push('/openapi')">
                去创建工具
              </el-button>
            </el-empty>
          </div>
        </div>
      </div>

      <!-- 右侧测试区域 -->
      <div class="testing-panel" v-if="selectedTool">
        <el-tabs v-model="activeTab" class="testing-tabs">
          <!-- 手动测试标签页 -->
          <el-tab-pane label="手动测试" name="manual">
            <div class="manual-test-form">
              <div class="form-header">
                <h4>{{ selectedTool.name }}</h4>
                <el-tag :type="getMethodTagType(selectedTool.method)">
                  {{ selectedTool.method.toUpperCase() }}
                </el-tag>
              </div>

              <div class="tool-description-text">
                {{ selectedTool.description }}
              </div>

              <!-- 参数表单 -->
              <div class="parameters-section">
                <h5>参数配置</h5>
                <el-form
                  ref="parametersFormRef"
                  :model="testParameters"
                  label-width="120px"
                  class="parameters-form"
                >
                  <div v-if="!hasParameters" class="no-parameters">
                    此工具无需参数
                  </div>

                  <template v-else>
                    <el-form-item
                      v-for="[paramName, paramSchema] in Object.entries(
                        toolParameters,
                      )"
                      :key="paramName"
                      :label="paramName"
                      :prop="paramName"
                      :rules="getParameterRules(paramName, paramSchema)"
                    >
                      <div class="parameter-input">
                        <component
                          :is="getParameterComponent(paramSchema.type)"
                          v-model="testParameters[paramName]"
                          :placeholder="getParameterPlaceholder(paramSchema)"
                          :disabled="loading"
                          v-bind="getParameterProps(paramSchema)"
                        />
                        <div class="parameter-info">
                          <span class="parameter-type">{{
                            paramSchema.type
                          }}</span>
                          <span
                            v-if="isRequired(paramName)"
                            class="required-mark"
                            >*</span
                          >
                        </div>
                      </div>
                      <div
                        v-if="paramSchema.description"
                        class="parameter-description"
                      >
                        {{ paramSchema.description }}
                      </div>
                    </el-form-item>
                  </template>
                </el-form>
              </div>

              <!-- 测试按钮 -->
              <div class="test-actions">
                <el-button
                  type="primary"
                  size="large"
                  :loading="testing"
                  @click="executeTest"
                  :icon="CaretRight"
                >
                  {{ testing ? "测试中..." : "执行测试" }}
                </el-button>
                <el-button @click="resetParameters" :disabled="testing">
                  重置参数
                </el-button>
                <el-button @click="fillSampleData" :disabled="testing">
                  填充示例数据
                </el-button>
              </div>

              <!-- 测试结果 -->
              <div v-if="testResult" class="result-section">
                <div class="result-header">
                  <h5>测试结果</h5>
                  <el-tag :type="testResult.success ? 'success' : 'danger'">
                    {{ testResult.success ? "成功" : "失败" }}
                  </el-tag>
                  <span class="execution-time">
                    执行时间: {{ testResult.executionTime }}ms
                  </span>
                </div>

                <div class="result-content">
                  <el-alert
                    v-if="!testResult.success"
                    :title="testResult.error"
                    type="error"
                    show-icon
                  />

                  <div v-else class="success-result">
                    <el-input
                      type="textarea"
                      :rows="8"
                      :value="JSON.stringify(testResult.data, null, 2)"
                      readonly
                    />
                  </div>
                </div>

                <div class="result-actions">
                  <el-button size="small" @click="copyResult">
                    <el-icon><CopyDocument /></el-icon>
                    复制结果
                  </el-button>
                  <el-button
                    size="small"
                    @click="saveAsTestCase"
                    v-if="testResult.success"
                  >
                    <el-icon><Plus /></el-icon>
                    保存为测试用例
                  </el-button>
                </div>
              </div>
            </div>
          </el-tab-pane>

          <!-- 测试用例标签页 -->
          <el-tab-pane label="测试用例" name="testcases">
            <div class="test-cases-section">
              <div class="test-cases-header">
                <div class="search-filters">
                  <el-input
                    v-model="testCaseSearchText"
                    placeholder="搜索测试用例..."
                    :prefix-icon="Search"
                    clearable
                    style="width: 200px"
                  />
                  <el-select
                    v-model="selectedTag"
                    placeholder="筛选标签"
                    clearable
                    style="width: 150px"
                  >
                    <el-option
                      v-for="tag in availableTags"
                      :key="tag"
                      :label="tag"
                      :value="tag"
                    />
                  </el-select>
                </div>
              </div>

              <div class="test-cases-list">
                <div
                  v-for="testCase in filteredTestCases"
                  :key="testCase.id"
                  class="test-case-item"
                >
                  <div class="test-case-info">
                    <div class="test-case-name">{{ testCase.name }}</div>
                    <div class="test-case-meta">
                      <el-tag
                        v-for="tag in testCase.tags"
                        :key="tag"
                        size="small"
                        style="margin-right: 4px"
                      >
                        {{ tag }}
                      </el-tag>
                      <span class="test-case-date">
                        {{ formatDate(testCase.createdAt) }}
                      </span>
                    </div>
                  </div>

                  <div class="test-case-actions">
                    <el-button size="small" @click="runTestCase(testCase)">
                      运行
                    </el-button>
                    <el-button size="small" @click="editTestCase(testCase)">
                      编辑
                    </el-button>
                    <el-button
                      size="small"
                      type="danger"
                      @click="deleteTestCase(testCase.id)"
                    >
                      删除
                    </el-button>
                  </div>
                </div>

                <div v-if="filteredTestCases.length === 0" class="empty-state">
                  <el-empty description="暂无测试用例" />
                </div>
              </div>
            </div>
          </el-tab-pane>

          <!-- 测试历史标签页 -->
          <el-tab-pane label="测试历史" name="history">
            <div class="test-history-section">
              <div class="history-list">
                <div
                  v-for="historyItem in recentHistory"
                  :key="historyItem.id"
                  class="history-item"
                >
                  <div class="history-info">
                    <div class="history-tool">
                      {{ getToolName(historyItem.toolId) }}
                    </div>
                    <div class="history-time">
                      {{ formatDateTime(historyItem.timestamp) }}
                    </div>
                  </div>

                  <div class="history-result">
                    <el-tag
                      :type="historyItem.result.success ? 'success' : 'danger'"
                    >
                      {{ historyItem.result.success ? "成功" : "失败" }}
                    </el-tag>
                    <span class="execution-time">
                      {{ historyItem.result.executionTime }}ms
                    </span>
                  </div>

                  <div class="history-actions">
                    <el-button
                      size="small"
                      @click="viewHistoryDetails(historyItem)"
                    >
                      查看详情
                    </el-button>
                    <el-button
                      size="small"
                      @click="rerunFromHistory(historyItem)"
                    >
                      重新运行
                    </el-button>
                  </div>
                </div>

                <div v-if="recentHistory.length === 0" class="empty-state">
                  <el-empty description="暂无测试历史" />
                </div>
              </div>
            </div>
          </el-tab-pane>
        </el-tabs>
      </div>

      <!-- 未选择工具时的提示 -->
      <div v-else class="no-tool-selected">
        <el-empty description="请选择一个工具开始测试" />
      </div>
    </div>

    <!-- 创建测试用例对话框 -->
    <el-dialog
      v-model="createTestCaseDialogVisible"
      title="创建测试用例"
      width="500px"
      :close-on-click-modal="false"
    >
      <el-form
        ref="createTestCaseFormRef"
        :model="newTestCase"
        label-width="80px"
        :rules="testCaseRules"
      >
        <el-form-item label="名称" prop="name">
          <el-input v-model="newTestCase.name" placeholder="输入测试用例名称" />
        </el-form-item>

        <el-form-item label="标签" prop="tags">
          <el-input v-model="tagsInput" placeholder="输入标签，用逗号分隔" />
        </el-form-item>

        <el-form-item label="期望结果">
          <el-input
            type="textarea"
            v-model="newTestCase.expectedResult"
            placeholder="描述期望的测试结果（可选）"
            :rows="3"
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="createTestCaseDialogVisible = false"
            >取消</el-button
          >
          <el-button type="primary" @click="createTestCase">创建</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 历史详情对话框 -->
    <el-dialog
      v-model="historyDetailsDialogVisible"
      title="测试历史详情"
      width="600px"
    >
      <div v-if="selectedHistoryItem" class="history-details">
        <div class="detail-section">
          <h4>基本信息</h4>
          <div class="detail-content">
            <p>
              <strong>工具:</strong>
              {{ getToolName(selectedHistoryItem.toolId) }}
            </p>
            <p>
              <strong>时间:</strong>
              {{ formatDateTime(selectedHistoryItem.timestamp) }}
            </p>
            <p>
              <strong>状态:</strong>
              <el-tag
                :type="
                  selectedHistoryItem.result.success ? 'success' : 'danger'
                "
              >
                {{ selectedHistoryItem.result.success ? "成功" : "失败" }}
              </el-tag>
            </p>
            <p>
              <strong>执行时间:</strong>
              {{ selectedHistoryItem.result.executionTime }}ms
            </p>
          </div>
        </div>

        <div class="detail-section">
          <h4>参数</h4>
          <el-input
            type="textarea"
            :value="JSON.stringify(selectedHistoryItem.parameters, null, 2)"
            readonly
            :rows="4"
          />
        </div>

        <div class="detail-section">
          <h4>结果</h4>
          <el-input
            type="textarea"
            :value="
              selectedHistoryItem.result.success
                ? JSON.stringify(selectedHistoryItem.result.data, null, 2)
                : selectedHistoryItem.result.error
            "
            readonly
            :rows="6"
          />
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from "vue";
import {
  ElMessage,
  ElMessageBox,
  type FormInstance,
  type FormRules,
} from "element-plus";
import {
  Tools,
  Plus,
  Refresh,
  Search,
  CaretRight,
  CopyDocument,
} from "@element-plus/icons-vue";

import { useTestingStore } from "@/stores/testing";
import { useOpenAPIStore } from "@/stores/openapi";
import { convertOpenAPIToMCPTools } from "@/utils/openapi";
import type { MCPTool, TestCase, ToolResult } from "@/types";

// 导入全局功能
import { useConfirmation } from "@/composables/useConfirmation";
import { useFormValidation } from "@/composables/useFormValidation";
import { usePerformanceMonitor } from "@/composables/usePerformance";
import LoadingOverlay from "@/shared/components/ui/LoadingOverlay.vue";

// Stores
const testingStore = useTestingStore();
const openApiStore = useOpenAPIStore();

// 全局功能
const { confirmDelete: globalConfirmDelete, confirmSave } = useConfirmation();

const { startMonitoring, stopMonitoring, measureFunction } =
  usePerformanceMonitor();

// Reactive data
const loading = ref(false);
const loadingTools = ref(false);
const testing = ref(false);
const activeTab = ref("manual");

// 工具选择和搜索
const selectedTool = ref<MCPTool | null>(null);
const toolSearchText = ref("");

// 测试参数
const testParameters = ref<Record<string, any>>({});
const testResult = ref<ToolResult | null>(null);
const parametersFormRef = ref<FormInstance>();

// 测试用例管理
const createTestCaseDialogVisible = ref(false);
const newTestCase = ref({
  name: "",
  expectedResult: "",
  tags: [] as string[],
});
const tagsInput = ref("");
const createTestCaseFormRef = ref<FormInstance>();
const testCaseSearchText = ref("");
const selectedTag = ref("");

// 历史记录
const historyDetailsDialogVisible = ref(false);
const selectedHistoryItem = ref<any>(null);

// Computed properties
const tools = computed(() => {
  const allTools: MCPTool[] = [];

  for (const spec of openApiStore.validSpecs) {
    try {
      const specTools = convertOpenAPIToMCPTools(spec.content);
      allTools.push(...specTools);
    } catch (error) {
      console.warn(`Failed to convert spec ${spec.name} to MCP tools:`, error);
    }
  }

  return allTools;
});

const filteredTools = computed(() => {
  if (!toolSearchText.value) return tools.value;

  const searchLower = toolSearchText.value.toLowerCase();
  return tools.value.filter(
    (tool: MCPTool) =>
      tool.name.toLowerCase().includes(searchLower) ||
      tool.description.toLowerCase().includes(searchLower) ||
      tool.method.toLowerCase().includes(searchLower),
  );
});

const toolParameters = computed(() => {
  if (!selectedTool.value?.parameters?.properties) return {};
  return selectedTool.value.parameters.properties;
});

const hasParameters = computed(() => {
  return Object.keys(toolParameters.value).length > 0;
});

const testCases = computed(() => {
  if (!selectedTool.value) return [];
  return testingStore.getTestCasesByTool(selectedTool.value.id);
});

const filteredTestCases = computed(() => {
  let filtered = testCases.value;

  if (testCaseSearchText.value) {
    const searchLower = testCaseSearchText.value.toLowerCase();
    filtered = filtered.filter((tc) =>
      tc.name.toLowerCase().includes(searchLower),
    );
  }

  if (selectedTag.value) {
    filtered = filtered.filter((tc) => tc.tags.includes(selectedTag.value));
  }

  return filtered;
});

const availableTags = computed(() => {
  const tags = new Set<string>();
  testCases.value.forEach((tc) => {
    tc.tags.forEach((tag) => tags.add(tag));
  });
  return Array.from(tags);
});

const recentHistory = computed(() => {
  return testingStore.getRecentTestHistory(20);
});

// 表单验证规则
const testCaseRules: FormRules = {
  name: [
    { required: true, message: "请输入测试用例名称", trigger: "blur" },
    { min: 2, max: 50, message: "长度在 2 到 50 个字符", trigger: "blur" },
  ],
};

// Methods
const selectTool = (tool: MCPTool) => {
  selectedTool.value = tool;
  resetParameters();
  testResult.value = null;
};

const resetParameters = () => {
  testParameters.value = {};
  // 设置默认值
  Object.entries(toolParameters.value).forEach(([name, schema]) => {
    testParameters.value[name] = getDefaultValue(schema);
  });
};

const fillSampleData = () => {
  Object.entries(toolParameters.value).forEach(([name, schema]) => {
    testParameters.value[name] = getSampleValue(schema);
  });
  ElMessage.success("已填充示例数据");
};

const getDefaultValue = (schema: any): any => {
  if (schema.default !== undefined) return schema.default;

  switch (schema.type) {
    case "string":
      return "";
    case "number":
    case "integer":
      return schema.minimum || 0;
    case "boolean":
      return false;
    case "array":
      return [];
    case "object":
      return {};
    default:
      return "";
  }
};

const getSampleValue = (schema: any): any => {
  if (schema.default !== undefined) return schema.default;

  switch (schema.type) {
    case "string":
      if (schema.enum) return schema.enum[0];
      if (schema.format === "email") return "test@example.com";
      if (schema.format === "date")
        return new Date().toISOString().split("T")[0];
      if (schema.format === "date-time") return new Date().toISOString();
      return "sample text";
    case "number":
      return schema.minimum || 123.45;
    case "integer":
      return schema.minimum || 123;
    case "boolean":
      return true;
    case "array":
      return ["sample item"];
    case "object":
      return { key: "value" };
    default:
      return "sample";
  }
};

const executeTest = async () => {
  if (!selectedTool.value) return;

  // 验证表单
  if (parametersFormRef.value) {
    const valid = await parametersFormRef.value.validate().catch(() => false);
    if (!valid) {
      ElMessage.error("请检查参数输入");
      return;
    }
  }

  testing.value = true;
  testResult.value = null;

  try {
    const result = await measureFunction("executeTest", async () => {
      return await testingStore.executeToolTest(
        selectedTool.value!,
        testParameters.value,
      );
    });
    testResult.value = result;

    if (result.success) {
      ElMessage.success("测试执行成功");
    } else {
      ElMessage.error(`测试执行失败: ${result.error}`);
    }
  } catch (error) {
    ElMessage.error(`测试执行异常: ${error}`);
  } finally {
    testing.value = false;
  }
};

const getParameterComponent = (type: string) => {
  switch (type) {
    case "boolean":
      return "el-switch";
    case "number":
    case "integer":
      return "el-input-number";
    default:
      return "el-input";
  }
};

const getParameterProps = (schema: any) => {
  const props: any = {};

  if (schema.type === "number" || schema.type === "integer") {
    if (schema.minimum !== undefined) props.min = schema.minimum;
    if (schema.maximum !== undefined) props.max = schema.maximum;
    if (schema.type === "integer") props.precision = 0;
  }

  if (schema.type === "string") {
    if (schema.minLength !== undefined) props.minlength = schema.minLength;
    if (schema.maxLength !== undefined) props.maxlength = schema.maxLength;
  }

  return props;
};

const getParameterPlaceholder = (schema: any): string => {
  if (schema.description) return schema.description;
  if (schema.example) return `例如: ${schema.example}`;

  switch (schema.type) {
    case "string":
      return "请输入字符串";
    case "number":
      return "请输入数字";
    case "integer":
      return "请输入整数";
    case "boolean":
      return "选择是否";
    default:
      return "请输入值";
  }
};

const getParameterRules = (paramName: string, schema: any) => {
  const rules: any[] = [];

  if (isRequired(paramName)) {
    rules.push({
      required: true,
      message: `${paramName} 是必需参数`,
      trigger: "blur",
    });
  }

  if (schema.type === "string" && schema.minLength) {
    rules.push({
      min: schema.minLength,
      message: `最少 ${schema.minLength} 个字符`,
      trigger: "blur",
    });
  }

  if (schema.type === "string" && schema.maxLength) {
    rules.push({
      max: schema.maxLength,
      message: `最多 ${schema.maxLength} 个字符`,
      trigger: "blur",
    });
  }

  return rules;
};

const isRequired = (paramName: string): boolean => {
  return selectedTool.value?.parameters?.required?.includes(paramName) || false;
};

const getMethodTagType = (method: string) => {
  const types: Record<string, string> = {
    GET: "success",
    POST: "primary",
    PUT: "warning",
    DELETE: "danger",
    PATCH: "info",
  };
  return types[method.toUpperCase()] || "info";
};

const copyResult = async () => {
  if (!testResult.value) return;

  const text = testResult.value.success
    ? JSON.stringify(testResult.value.data, null, 2)
    : testResult.value.error || "未知错误";

  try {
    await navigator.clipboard.writeText(text);
    ElMessage.success("结果已复制到剪贴板");
  } catch (error) {
    ElMessage.error("复制失败");
  }
};

const saveAsTestCase = () => {
  if (!selectedTool.value || !testResult.value?.success) return;

  newTestCase.value = {
    name: `${selectedTool.value.name} 测试用例`,
    expectedResult: JSON.stringify(testResult.value.data, null, 2),
    tags: [selectedTool.value.method.toUpperCase(), "from-manual-test"],
  };
  tagsInput.value = newTestCase.value.tags.join(", ");
  createTestCaseDialogVisible.value = true;
};

const showCreateTestCaseDialog = () => {
  if (!selectedTool.value) return;

  const template = testingStore.generateTestCaseTemplate(selectedTool.value);
  newTestCase.value = {
    name: template.name || "",
    expectedResult: "",
    tags: template.tags || [],
  };
  tagsInput.value = newTestCase.value.tags.join(", ");
  createTestCaseDialogVisible.value = true;
};

const createTestCase = async () => {
  if (!createTestCaseFormRef.value || !selectedTool.value) return;

  const valid = await createTestCaseFormRef.value.validate().catch(() => false);
  if (!valid) return;

  // 解析标签
  const tags = tagsInput.value
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag);

  testingStore.createTestCase({
    name: newTestCase.value.name,
    toolId: selectedTool.value.id,
    parameters: { ...testParameters.value },
    expectedResult: newTestCase.value.expectedResult || undefined,
    tags,
  });

  createTestCaseDialogVisible.value = false;
  newTestCase.value = { name: "", expectedResult: "", tags: [] };
  tagsInput.value = "";
};

const runTestCase = async (testCase: TestCase) => {
  if (!selectedTool.value) return;

  // 设置参数
  testParameters.value = { ...testCase.parameters };

  // 等待DOM更新后执行测试
  await nextTick();
  await executeTest();
};

const editTestCase = (testCase: TestCase) => {
  // 设置为当前测试用例的参数
  testParameters.value = { ...testCase.parameters };
  activeTab.value = "manual";
  ElMessage.info("测试用例参数已加载到手动测试表单");
};

const deleteTestCase = async (testCaseId: string) => {
  const testCase = testingStore.testCases.find((tc) => tc.id === testCaseId);
  const testCaseName = testCase?.name || "测试用例";

  const confirmed = await globalConfirmDelete(testCaseName);
  if (!confirmed) return;

  try {
    testingStore.deleteTestCase(testCaseId);
    ElMessage.success("测试用例删除成功");
  } catch (error) {
    ElMessage.error(`删除失败: ${error}`);
  }
};

const viewHistoryDetails = (historyItem: any) => {
  selectedHistoryItem.value = historyItem;
  historyDetailsDialogVisible.value = true;
};

const rerunFromHistory = async (historyItem: any) => {
  // 找到对应的工具
  const tool = tools.value.find((t: MCPTool) => t.id === historyItem.toolId);
  if (!tool) {
    ElMessage.error("工具不存在");
    return;
  }

  // 切换到该工具并设置参数
  selectTool(tool);
  testParameters.value = { ...historyItem.parameters };
  activeTab.value = "manual";

  // 执行测试
  await nextTick();
  await executeTest();
};

const getToolName = (toolId: string): string => {
  const tool = tools.value.find((t: MCPTool) => t.id === toolId);
  return tool?.name || "未知工具";
};

const formatDate = (date: Date): string => {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(date));
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

const refreshData = async () => {
  loading.value = true;
  try {
    await openApiStore.fetchSpecs();
    ElMessage.success("数据刷新成功");
  } catch (error) {
    ElMessage.error("数据刷新失败");
  } finally {
    loading.value = false;
  }
};

// 生命周期
onMounted(async () => {
  loadingTools.value = true;
  try {
    await openApiStore.fetchSpecs();
  } catch (error) {
    ElMessage.error("加载工具列表失败");
  } finally {
    loadingTools.value = false;
  }
});
</script>

<style scoped>
.api-tester {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 20px;
  background-color: var(--el-bg-color-page);
}

.header-section {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--el-border-color-light);
}

.header-content h1 {
  margin: 0 0 8px 0;
  color: var(--el-text-color-primary);
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 24px;
  font-weight: 600;
}

.header-description {
  margin: 0;
  color: var(--el-text-color-regular);
  font-size: 14px;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.main-content {
  flex: 1;
  display: flex;
  gap: 20px;
  min-height: 0;
}

.tools-panel {
  width: 300px;
  background: white;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  display: flex;
  flex-direction: column;
}

.panel-header {
  margin-bottom: 16px;
}

.panel-header h3 {
  margin: 0 0 12px 0;
  color: var(--el-text-color-primary);
  font-size: 16px;
  font-weight: 600;
}

.tools-list {
  flex: 1;
  overflow-y: auto;
}

.tool-item {
  padding: 12px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 6px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.tool-item:hover {
  border-color: var(--el-color-primary);
  background-color: var(--el-color-primary-light-9);
}

.tool-item.active {
  border-color: var(--el-color-primary);
  background-color: var(--el-color-primary-light-8);
}

.tool-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.tool-name {
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.tool-method {
  font-size: 12px;
  padding: 2px 6px;
  border-radius: 4px;
  background-color: var(--el-color-info-light-8);
  color: var(--el-color-info);
  font-weight: 500;
}

.tool-description {
  font-size: 12px;
  color: var(--el-text-color-regular);
  line-height: 1.4;
}

.testing-panel {
  flex: 1;
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  overflow-y: auto;
}

.testing-tabs {
  height: 100%;
}

.manual-test-form {
  max-width: 800px;
}

.form-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.form-header h4 {
  margin: 0;
  color: var(--el-text-color-primary);
  font-size: 18px;
}

.tool-description-text {
  color: var(--el-text-color-regular);
  margin-bottom: 24px;
  padding: 12px;
  background-color: var(--el-bg-color-page);
  border-radius: 6px;
  font-size: 14px;
  line-height: 1.5;
}

.parameters-section h5 {
  margin: 0 0 16px 0;
  color: var(--el-text-color-primary);
  font-size: 16px;
  font-weight: 600;
}

.no-parameters {
  text-align: center;
  color: var(--el-text-color-regular);
  padding: 20px;
  background-color: var(--el-bg-color-page);
  border-radius: 6px;
  font-size: 14px;
}

.parameter-input {
  display: flex;
  align-items: center;
  gap: 8px;
}

.parameter-input > :first-child {
  flex: 1;
}

.parameter-info {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.parameter-type {
  padding: 2px 6px;
  background-color: var(--el-color-info-light-8);
  border-radius: 4px;
}

.required-mark {
  color: var(--el-color-danger);
  font-weight: 600;
}

.parameter-description {
  margin-top: 4px;
  font-size: 12px;
  color: var(--el-text-color-regular);
  line-height: 1.4;
}

.test-actions {
  margin: 24px 0;
  display: flex;
  gap: 12px;
}

.result-section {
  margin-top: 24px;
  padding: 16px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  background-color: var(--el-bg-color-page);
}

.result-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.result-header h5 {
  margin: 0;
  color: var(--el-text-color-primary);
  font-size: 16px;
  font-weight: 600;
}

.execution-time {
  color: var(--el-text-color-secondary);
  font-size: 14px;
}

.result-content {
  margin-bottom: 12px;
}

.result-actions {
  display: flex;
  gap: 8px;
}

.test-cases-section,
.test-history-section {
  max-width: 800px;
}

.test-cases-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.search-filters {
  display: flex;
  gap: 12px;
}

.test-case-item,
.history-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 6px;
  margin-bottom: 8px;
  background: white;
}

.test-case-info,
.history-info {
  flex: 1;
}

.test-case-name,
.history-tool {
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin-bottom: 4px;
}

.test-case-meta,
.history-time {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.test-case-date {
  margin-left: auto;
}

.test-case-actions,
.history-actions {
  display: flex;
  gap: 8px;
}

.history-result {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-right: 16px;
}

.no-tool-selected {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
}

.history-details .detail-section {
  margin-bottom: 20px;
}

.history-details .detail-section h4 {
  margin: 0 0 8px 0;
  color: var(--el-text-color-primary);
  font-size: 14px;
  font-weight: 600;
}

.history-details .detail-content p {
  margin: 4px 0;
  font-size: 14px;
}

@media (max-width: 768px) {
  .main-content {
    flex-direction: column;
  }

  .tools-panel {
    width: 100%;
  }

  .header-section {
    flex-direction: column;
    gap: 12px;
    align-items: stretch;
  }

  .search-filters {
    flex-direction: column;
  }
}
</style>
