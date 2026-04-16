<template>
  <div class="endpoint-registry">
    <div class="page-header">
      <div>
        <h1>{{ t("endpointRegistry.title") }}</h1>
        <p class="muted">
          {{ activeSubtitle }}
        </p>
      </div>
      <div class="header-actions">
        <el-button
          v-if="selectedSourceType === 'manual'"
          type="warning"
          @click="openCreateDialog"
        >
          {{ t("endpointRegistry.actions.addManualEndpoint") }}
        </el-button>
        <el-button type="primary" @click="loadOverview" :loading="loading">
          {{ t("common.refresh") }}
        </el-button>
      </div>
    </div>

    <el-card shadow="never" class="toolbar-card">
      <el-row :gutter="12">
        <el-col :xs="24" :md="12">
            <el-radio-group v-model="selectedSourceType" size="small">
            <el-radio-button label="manual">
              {{ sourceTypeLabel.manual }}
            </el-radio-button>
            <el-radio-button label="imported">
              {{ sourceTypeLabel.imported }}
            </el-radio-button>
          </el-radio-group>
        </el-col>
        <el-col :xs="24" :md="12">
          <el-input
            v-model="search"
            clearable
            :placeholder="t('endpointRegistry.searchPlaceholder')"
          />
        </el-col>
      </el-row>
    </el-card>

    <el-alert
      v-if="errorMessage"
      type="error"
      :title="errorMessage"
      show-icon
      class="mb-12"
    />

    <el-empty
      v-if="!loading && filteredGroups.length === 0"
      :description="t('endpointRegistry.empty')"
    />

    <el-collapse v-else v-model="expandedGroupKeys">
      <el-collapse-item
        v-for="group in filteredGroups"
        :key="group.groupKey"
        :name="group.groupKey"
      >
        <template #title>
          <div class="group-title">
            <el-tag type="info">{{ group.baseUrl }}</el-tag>
            <span class="count">{{
              t("endpointRegistry.groupCount", { count: group.endpoints.length })
            }}</span>
          </div>
        </template>

        <el-table :data="group.endpoints" size="small" border style="width: 100%" table-layout="auto">
          <el-table-column prop="name" :label="t('endpointRegistry.table.name')" min-width="180" />
          <el-table-column
            prop="methodPath"
            :label="t('endpointRegistry.table.methodPath')"
            min-width="220"
          />
          <el-table-column
            prop="lifecycleStatus"
            :label="t('endpointRegistry.table.lifecycle')"
            width="120"
          >
            <template #default="{ row }">
              <el-tag :type="getLifecycleTagType(row.lifecycleStatus)">
                {{ getLifecycleLabel(row.lifecycleStatus) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="lastProbeStatus" :label="t('endpointRegistry.table.probe')" width="120">
            <template #default="{ row }">
              <el-tag :type="getProbeTagType(row.lastProbeStatus)">
                {{ getProbeLabel(row.lastProbeStatus) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column
            prop="lastProbeSummary"
            :label="probeDetailsLabel"
            min-width="280"
            show-overflow-tooltip
          />
          <el-table-column
            prop="publishEnabled"
            :label="t('endpointRegistry.table.publishEnabled')"
            width="130"
          >
            <template #default="{ row }">
              <el-tag :type="row.publishEnabled ? 'success' : 'info'">
                {{ row.publishEnabled ? t("common.yes") : t("common.no") }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column
            prop="updatedAtText"
            :label="t('endpointRegistry.table.updatedAt')"
            min-width="180"
          />
          <el-table-column :label="t('endpointRegistry.table.actions')" width="360" fixed="right">
            <template #default="{ row }">
              <div class="row-actions">
                <el-button
                  size="small"
                  :icon="Connection"
                  class="action-btn"
                  @click="handleProbe(row)"
                  :loading="isActionLoading(row.id, 'probe')"
                >
                  {{ t("endpointRegistry.actions.probe") }}
                </el-button>
                <el-button
                  size="small"
                  :icon="CircleCheck"
                  class="action-btn"
                  @click="handleReadiness(row)"
                  :loading="isActionLoading(row.id, 'readiness')"
                >
                  {{ t("endpointRegistry.actions.readiness") }}
                </el-button>
                <el-button
                  size="small"
                  type="success"
                  :icon="UploadFilled"
                  class="action-btn"
                  @click="handlePublish(row)"
                  :loading="isActionLoading(row.id, 'publish')"
                >
                  {{ t("endpointRegistry.actions.publish") }}
                </el-button>
                <el-button
                  size="small"
                  type="warning"
                  :icon="SwitchButton"
                  class="action-btn"
                  @click="handleOffline(row)"
                  :loading="isActionLoading(row.id, 'offline')"
                >
                  {{ t("endpointRegistry.actions.offline") }}
                </el-button>
                <el-button
                  v-if="row.sourceType === 'manual'"
                  size="small"
                  type="primary"
                  plain
                  :icon="EditIcon"
                  class="action-btn"
                  @click="handleEdit(row)"
                  :loading="isActionLoading(row.id, 'edit')"
                >
                  {{ t("endpointRegistry.actions.edit") }}
                </el-button>
                <el-button
                  v-if="row.sourceType === 'manual'"
                  size="small"
                  type="danger"
                  plain
                  :icon="DeleteIcon"
                  class="action-btn delete-action-btn"
                  @click="handleDelete(row)"
                  :loading="isActionLoading(row.id, 'delete')"
                >
                  {{ t("endpointRegistry.actions.delete") }}
                </el-button>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </el-collapse-item>
    </el-collapse>

    <el-dialog
      v-model="showCreateDialog"
      :title="dialogTitle"
      width="640px"
      align-center
      @closed="resetCreateForm"
    >
      <el-form
        ref="createFormRef"
        :model="createForm"
        :rules="createFormRules"
        label-width="130px"
      >
        <el-form-item :label="t('endpointRegistry.form.name')" prop="name">
          <el-input
            v-model="createForm.name"
            clearable
            :placeholder="t('endpointRegistry.form.namePlaceholder')"
          />
        </el-form-item>
        <el-form-item :label="t('endpointRegistry.form.baseUrl')" prop="baseUrl">
          <el-input
            v-model="createForm.baseUrl"
            clearable
            :placeholder="t('endpointRegistry.form.baseUrlPlaceholder')"
          />
        </el-form-item>
        <el-form-item :label="t('endpointRegistry.form.method')" prop="method">
          <el-select v-model="createForm.method" style="width: 100%">
            <el-option label="GET" value="GET" />
            <el-option label="POST" value="POST" />
            <el-option label="PUT" value="PUT" />
            <el-option label="PATCH" value="PATCH" />
            <el-option label="DELETE" value="DELETE" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('endpointRegistry.form.path')" prop="path">
          <el-input
            v-model="createForm.path"
            clearable
            :placeholder="t('endpointRegistry.form.pathPlaceholder')"
          />
        </el-form-item>
        <el-form-item :label="t('endpointRegistry.form.description')">
          <el-input v-model="createForm.description" type="textarea" :rows="2" />
        </el-form-item>
        <el-form-item :label="t('endpointRegistry.form.businessDomain')">
          <el-input
            v-model="createForm.businessDomain"
            clearable
            :placeholder="t('endpointRegistry.form.businessDomainPlaceholder')"
          />
        </el-form-item>
        <el-form-item :label="t('endpointRegistry.form.riskLevel')">
          <el-select v-model="createForm.riskLevel" style="width: 100%">
            <el-option label="low" value="low" />
            <el-option label="medium" value="medium" />
            <el-option label="high" value="high" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="showCreateDialog = false">{{ t("common.cancel") }}</el-button>
          <el-button type="primary" :loading="creating" @click="submitCreateForm">
            {{
              creating
                ? t(formMode === "edit" ? "common.updating" : "endpointRegistry.messages.submitting")
                : t(formMode === "edit" ? "common.update" : "common.create")
            }}
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import type { FormInstance } from "element-plus";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  Connection,
  CircleCheck,
  UploadFilled,
  SwitchButton,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from "@element-plus/icons-vue";
import { useI18n } from "vue-i18n";
import { useRoute, useRouter } from "vue-router";
import { serverAPI } from "@/services/api";

const { t, locale } = useI18n();
const route = useRoute();
const router = useRouter();

type ApiCenterRow = {
  id: string;
  name: string;
  updatedAt?: string;
  endpoint?: {
    method?: string;
    path?: string;
  };
  endpoints?: Array<{
    method: string;
    path: string;
  }>;
  profile?: {
    sourceType?: "manual" | "imported";
    sourceRef?: string;
    probeUrl?: string;
    lifecycleStatus?: string;
    publishEnabled?: boolean;
    lastProbeStatus?: string;
    lastProbeError?: string;
    lastProbeHttpStatus?: number;
  };
};

type EndpointRow = {
  id: string;
  serverId: string;
  name: string;
  baseUrl: string;
  endpointPath: string;
  methodPath: string;
  sourceType: "manual" | "imported";
  lifecycleStatus: string;
  publishEnabled: boolean;
  lastProbeStatus: string;
  lastProbeSummary: string;
  updatedAtText: string;
};

type Group = {
  groupKey: string;
  baseUrl: string;
  endpoints: EndpointRow[];
};

const loading = ref(false);
const errorMessage = ref("");
const search = ref("");
const rows = ref<EndpointRow[]>([]);
const expandedGroupKeys = ref<string[]>([]);
const selectedSourceType = ref<"manual" | "imported">("manual");
const actionLoading = ref<Record<string, string>>({});
const showCreateDialog = ref(false);
const creating = ref(false);
const formMode = ref<"create" | "edit">("create");
const editingRowId = ref("");
const editingServerConfig = ref<Record<string, any> | null>(null);
const createFormRef = ref<FormInstance>();
const createForm = ref({
  name: "",
  baseUrl: "",
  method: "GET",
  path: "",
  description: "",
  businessDomain: "",
  riskLevel: "medium",
});

const createFormRules = {
  name: [
    {
      required: true,
      message: t("endpointRegistry.validation.nameRequired"),
      trigger: "blur",
    },
  ],
  baseUrl: [
    {
      required: true,
      message: t("endpointRegistry.validation.baseUrlRequired"),
      trigger: "blur",
    },
    {
      type: "url",
      message: t("endpointRegistry.validation.baseUrlInvalid"),
      trigger: "blur",
    },
  ],
  method: [
    {
      required: true,
      message: t("endpointRegistry.validation.methodRequired"),
      trigger: "change",
    },
  ],
  path: [
    {
      required: true,
      message: t("endpointRegistry.validation.pathRequired"),
      trigger: "blur",
    },
    {
      validator: (_: unknown, value: string, callback: (err?: Error) => void) => {
        if (!value || value.startsWith("/")) {
          callback();
          return;
        }
        callback(new Error(t("endpointRegistry.validation.pathSlashRequired")));
      },
      trigger: "blur",
    },
  ],
};

const isActionLoading = (
  rowId: string,
  action: "probe" | "readiness" | "publish" | "offline" | "edit" | "delete",
) => actionLoading.value[rowId] === action;

const setActionLoading = (
  rowId: string,
  action: "probe" | "readiness" | "publish" | "offline" | "edit" | "delete" | "",
) => {
  if (!action) {
    delete actionLoading.value[rowId];
    return;
  }
  actionLoading.value[rowId] = action;
};

const dialogTitle = computed(() =>
  t(formMode.value === "edit" ? "endpointRegistry.dialog.editTitle" : "endpointRegistry.dialog.title"),
);

const activeSubtitle = computed(() =>
  locale.value.startsWith("zh")
    ? selectedSourceType.value === "manual"
      ? "按 Server URL 分组管理手工 Endpoint，与 OpenAPI 文档管理隔离。"
      : "对导入 Endpoint 提供轻量生命周期治理，并与手工录入分开管理。"
    : selectedSourceType.value === "manual"
      ? "Manual endpoints grouped by Server URL (baseUrl), isolated from OpenAPI specs."
      : "Imported endpoints with lightweight lifecycle governance, kept separate from manual registration.",
);

const sourceTypeLabel = computed(() =>
  locale.value.startsWith("zh")
    ? { manual: "手工", imported: "导入" }
    : { manual: "Manual", imported: "Imported" },
);

const probeDetailsLabel = computed(() =>
  locale.value.startsWith("zh") ? "探测说明" : "Probe Details",
);

const openCreateDialog = () => {
  resetCreateForm();
  formMode.value = "create";
  showCreateDialog.value = true;
};

const normalizeBaseUrl = (url?: string) => {
  if (!url) return "unknown";
  return url.trim().replace(/\/+$/, "").toLowerCase();
};

const extractMethodAndPath = (openApiData: any): { method: string; path: string } => {
  const paths = openApiData?.paths;
  if (!paths || typeof paths !== "object") {
    return { method: "GET", path: "/" };
  }

  const firstPath = Object.keys(paths)[0];
  if (!firstPath) {
    return { method: "GET", path: "/" };
  }

  const firstMethods = paths[firstPath];
  const method = Object.keys(firstMethods || {})[0]?.toUpperCase() || "GET";
  return { method, path: firstPath };
};

const buildManualOpenApiData = (payload: {
  name: string;
  description?: string;
  baseUrl: string;
  method: string;
  path: string;
  version?: string;
}) => ({
  openapi: "3.0.3",
  info: {
    title: payload.name,
    version: payload.version || "1.0.0",
    description: payload.description || "Manual endpoint registration",
  },
  servers: [{ url: payload.baseUrl }],
  paths: {
    [payload.path]: {
      [payload.method.toLowerCase()]: {
        summary: payload.description || `${payload.method.toUpperCase()} ${payload.path}`,
        responses: {
          "200": { description: "OK" },
        },
      },
    },
  },
});

const buildProbeUrl = (baseUrl: string, path: string) => {
  const normalizedBaseUrl = String(baseUrl || "").replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBaseUrl}${normalizedPath}`;
};

const getLifecycleLabel = (status?: string) =>
  t(`endpointRegistry.lifecycleStatus.${status || "draft"}`);

const getLifecycleTagType = (status?: string) => {
  switch (status) {
    case "published":
      return "success";
    case "verified":
      return "primary";
    case "degraded":
      return "danger";
    case "offline":
      return "warning";
    case "retired":
      return "info";
    case "draft":
    default:
      return "info";
  }
};

const getProbeLabel = (status?: string) =>
  t(`endpointRegistry.probeStatus.${status || "unknown"}`);

const getProbeTagType = (status?: string) => {
  switch (status) {
    case "healthy":
      return "success";
    case "unhealthy":
      return "danger";
    case "unknown":
    default:
      return "info";
  }
};

const isValidationLikeProbe = (httpStatus?: number) =>
  [400, 401, 403, 405, 409, 415, 422, 429].includes(Number(httpStatus));

const formatProbeSummary = ({
  probeStatus,
  httpStatus,
  errorMessage,
}: {
  probeStatus?: string;
  httpStatus?: number;
  errorMessage?: string;
}) => {
  const normalizedStatus = probeStatus || "unknown";

  if (normalizedStatus === "healthy" && isValidationLikeProbe(httpStatus)) {
    if (locale.value.startsWith("zh")) {
      return `探测通过：服务可达（HTTP ${httpStatus}），但当前请求缺少必要参数、认证信息，或不满足该接口的调用条件。${errorMessage ? ` 详情：${errorMessage}` : ""}`;
    }
    return `Probe passed: endpoint is reachable (HTTP ${httpStatus}), but the current request is missing required input/authentication or does not satisfy this operation. ${errorMessage ? `Details: ${errorMessage}` : ""}`;
  }

  if (normalizedStatus === "healthy") {
    if (locale.value.startsWith("zh")) {
      return `探测通过：端点可达${httpStatus ? `（HTTP ${httpStatus}）` : ""}`;
    }
    return `Probe passed: endpoint is reachable${httpStatus ? ` (HTTP ${httpStatus})` : ""}`;
  }

  if (normalizedStatus === "unhealthy") {
    if (locale.value.startsWith("zh")) {
      return `探测失败${httpStatus ? `（HTTP ${httpStatus}）` : ""}${errorMessage ? `：${errorMessage}` : ""}`;
    }
    return `Probe failed${httpStatus ? ` (HTTP ${httpStatus})` : ""}${errorMessage ? `: ${errorMessage}` : ""}`;
  }

  return locale.value.startsWith("zh") ? "尚无探测记录" : "No probe record yet";
};

const formatProbeFeedback = (result: {
  probe?: {
    status?: string;
    httpStatus?: number;
    errorMessage?: string;
  };
}) => {
  const probeStatus = result?.probe?.status || "unknown";
  const httpStatus = result?.probe?.httpStatus;
  const errorMessage = result?.probe?.errorMessage;

  if (probeStatus === "healthy" || probeStatus === "unhealthy") {
    return formatProbeSummary({
      probeStatus,
      httpStatus,
      errorMessage,
    });
  }

  return t("endpointRegistry.messages.probeFinished", { status: probeStatus });
};

const detectMethodPath = (item: ApiCenterRow) => {
  if (item.endpoint?.method && item.endpoint?.path) {
    return `${item.endpoint.method} ${item.endpoint.path}`;
  }

  const paths = (item as any)?.openApiData?.paths;
  if (!paths || typeof paths !== "object") return "-";
  const firstPath = Object.keys(paths)[0];
  if (!firstPath) return "-";
  const methods = Object.keys(paths[firstPath] || {});
  const method = methods[0]?.toUpperCase() || "METHOD";
  return `${method} ${firstPath}`;
};

const mapRow = (item: ApiCenterRow): EndpointRow => {
  const baseUrl = normalizeBaseUrl(item.profile?.sourceRef || item.profile?.probeUrl);
  return {
    id: item.id,
    serverId: item.id,
    name: item.name,
    baseUrl,
    endpointPath: item.endpoint?.path || "",
    methodPath: detectMethodPath(item),
    sourceType: (item.profile?.sourceType as "manual" | "imported") || "imported",
    lifecycleStatus: item.profile?.lifecycleStatus || "draft",
    publishEnabled: Boolean(item.profile?.publishEnabled),
    lastProbeStatus: item.profile?.lastProbeStatus || "unknown",
    lastProbeSummary: formatProbeSummary({
      probeStatus: item.profile?.lastProbeStatus,
      httpStatus: item.profile?.lastProbeHttpStatus,
      errorMessage: item.profile?.lastProbeError,
    }),
    updatedAtText: item.updatedAt ? new Date(item.updatedAt).toLocaleString() : "-",
  };
};

const mapImportedRows = (item: ApiCenterRow): EndpointRow[] => {
  const baseUrl = normalizeBaseUrl(item.profile?.sourceRef || item.profile?.probeUrl);
  const endpoints = Array.isArray(item.endpoints) && item.endpoints.length > 0
    ? item.endpoints
    : item.endpoint?.path
      ? [{ method: item.endpoint.method || "GET", path: item.endpoint.path }]
      : [];

  if (endpoints.length === 0) {
    return [mapRow(item)];
  }

  return endpoints.map((endpoint) => ({
    id: `${item.id}::${endpoint.method}::${endpoint.path}`,
    serverId: item.id,
    name: item.name,
    baseUrl,
    endpointPath: endpoint.path,
    methodPath: `${endpoint.method} ${endpoint.path}`,
    sourceType: (item.profile?.sourceType as "manual" | "imported") || "imported",
    lifecycleStatus: item.profile?.lifecycleStatus || "draft",
    publishEnabled: Boolean(item.profile?.publishEnabled),
    lastProbeStatus: item.profile?.lastProbeStatus || "unknown",
    lastProbeSummary: formatProbeSummary({
      probeStatus: item.profile?.lastProbeStatus,
      httpStatus: item.profile?.lastProbeHttpStatus,
      errorMessage: item.profile?.lastProbeError,
    }),
    updatedAtText: item.updatedAt ? new Date(item.updatedAt).toLocaleString() : "-",
  }));
};

const grouped = computed<Group[]>(() => {
  const map = new Map<string, EndpointRow[]>();
  for (const row of rows.value) {
    if (!map.has(row.baseUrl)) {
      map.set(row.baseUrl, []);
    }
    map.get(row.baseUrl)!.push(row);
  }
  return Array.from(map.entries())
    .map(([groupKey, endpoints]) => ({
      groupKey,
      baseUrl: groupKey,
      endpoints: endpoints.sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => a.baseUrl.localeCompare(b.baseUrl));
});

const filteredGroups = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return grouped.value;
  return grouped.value
    .map((group) => ({
      ...group,
      endpoints: group.endpoints.filter(
        (ep) =>
          ep.baseUrl.includes(q) ||
          ep.name.toLowerCase().includes(q) ||
          ep.methodPath.toLowerCase().includes(q),
      ),
    }))
    .filter((group) => group.endpoints.length > 0);
});

const loadOverview = async () => {
  loading.value = true;
  errorMessage.value = "";
  try {
    const result = await serverAPI.getApiCenterOverview({
      sourceType: selectedSourceType.value,
    });
    const data = Array.isArray(result?.data) ? result.data : [];
    rows.value = data.flatMap((item) =>
      selectedSourceType.value === "imported"
        ? mapImportedRows(item as ApiCenterRow)
        : [mapRow(item as ApiCenterRow)],
    );
    expandedGroupKeys.value = grouped.value.map((g) => g.groupKey);
  } catch (error: any) {
    rows.value = [];
    errorMessage.value =
      error?.message || t("endpointRegistry.messages.loadFailed");
  } finally {
    loading.value = false;
  }
};

const resetCreateForm = () => {
  formMode.value = "create";
  editingRowId.value = "";
  editingServerConfig.value = null;
  createForm.value = {
    name: "",
    baseUrl: "",
    method: "GET",
    path: "",
    description: "",
    businessDomain: "",
    riskLevel: "medium",
  };
  createFormRef.value?.clearValidate();
};

const submitCreateForm = async () => {
  if (!createFormRef.value) return;
  try {
    await createFormRef.value.validate();
    creating.value = true;
    const normalizedBaseUrl = createForm.value.baseUrl.trim().replace(/\/+$/, "");
    const payload = {
      name: createForm.value.name.trim(),
      baseUrl: normalizedBaseUrl,
      method: createForm.value.method.toUpperCase(),
      path: createForm.value.path.trim(),
      description: createForm.value.description?.trim() || undefined,
      businessDomain: createForm.value.businessDomain?.trim() || undefined,
      riskLevel: createForm.value.riskLevel || undefined,
    };

    if (formMode.value === "edit" && editingRowId.value) {
      const existingConfig = editingServerConfig.value || {};
      const existingManagement = (existingConfig.management || {}) as Record<string, any>;
      await serverAPI.updateServer(editingRowId.value, {
        name: payload.name,
        description: payload.description,
        openApiData: buildManualOpenApiData({
          name: payload.name,
          description: payload.description,
          baseUrl: payload.baseUrl,
          method: payload.method,
          path: payload.path,
        }),
        config: {
          ...existingConfig,
          management: {
            ...existingManagement,
            sourceType: "manual",
            sourceRef: payload.baseUrl,
            probeUrl: buildProbeUrl(payload.baseUrl, payload.path),
            businessDomain: payload.businessDomain,
            riskLevel: payload.riskLevel,
          },
        },
      });
      ElMessage.success(t("endpointRegistry.messages.updateSuccess"));
    } else {
      await serverAPI.registerManualEndpoint(payload);
      ElMessage.success(t("endpointRegistry.messages.createSuccess"));
    }

    showCreateDialog.value = false;
    await loadOverview();
  } catch (error: any) {
    ElMessage.error(
      error?.message ||
        t(formMode.value === "edit"
          ? "endpointRegistry.messages.updateFailed"
          : "endpointRegistry.messages.createFailed"),
    );
  } finally {
    creating.value = false;
  }
};

const handleEdit = async (row: EndpointRow) => {
  try {
    setActionLoading(row.id, "edit");
    const detail = await serverAPI.getServerDetails(row.id);
    const openApiData = (detail as any)?.openApiData || {};
    const methodPath = extractMethodAndPath(openApiData);
    const management = ((detail as any)?.config?.management || {}) as Record<string, any>;
    const fallbackBaseUrl =
      openApiData?.servers?.[0]?.url || management.sourceRef || management.probeUrl || row.baseUrl;

    createForm.value = {
      name: (detail as any)?.name || row.name,
      baseUrl: String(fallbackBaseUrl || "").replace(/\/+$/, ""),
      method: methodPath.method || "GET",
      path: methodPath.path || "/",
      description: (detail as any)?.description || "",
      businessDomain: management.businessDomain || "",
      riskLevel: management.riskLevel || "medium",
    };
    editingRowId.value = row.id;
    editingServerConfig.value = ((detail as any)?.config || {}) as Record<string, any>;
    formMode.value = "edit";
    showCreateDialog.value = true;
  } catch (error: any) {
    ElMessage.error(error?.message || t("endpointRegistry.messages.updateFailed"));
  } finally {
    setActionLoading(row.id, "");
  }
};

const handleDelete = async (row: EndpointRow) => {
  try {
    await ElMessageBox.confirm(
      t("endpointRegistry.messages.confirmDeleteText", { name: row.name }),
      t("endpointRegistry.messages.confirmDeleteTitle"),
      { type: "warning" },
    );
    setActionLoading(row.id, "delete");
    await serverAPI.deleteServer(row.id);
    ElMessage.success(t("endpointRegistry.messages.deleteSuccess"));
    await loadOverview();
  } catch (error: any) {
    if (error === "cancel" || error === "close") return;
    ElMessage.error(error?.message || t("endpointRegistry.messages.deleteFailed"));
  } finally {
    setActionLoading(row.id, "");
  }
};

const handleProbe = async (row: EndpointRow) => {
  try {
    setActionLoading(row.id, "probe");
    const result = await serverAPI.probeApiCenterEndpoint(row.serverId, {
      path: row.sourceType === "imported" ? row.endpointPath : undefined,
    });
    const probeStatus = result?.probe?.status || "unknown";
    const feedback = formatProbeFeedback(result);
    if (probeStatus === "healthy") {
      ElMessage.success(feedback);
    } else if (probeStatus === "unknown") {
      ElMessage.warning(feedback);
    } else {
      ElMessage.error(feedback);
    }
    await loadOverview();
  } catch (error: any) {
    ElMessage.error(error?.message || t("endpointRegistry.messages.probeFailed"));
  } finally {
    setActionLoading(row.id, "");
  }
};

const handleReadiness = async (row: EndpointRow) => {
  try {
    setActionLoading(row.id, "readiness");
    const result = await serverAPI.getApiCenterPublishReadiness(row.serverId);
    if (result.ready) {
      ElMessage.success(t("endpointRegistry.messages.readinessReady"));
      return;
    }
    ElMessage.warning(
      t("endpointRegistry.messages.readinessBlocked", {
        reasons: (result.reasons || []).join("; ") || t("endpointRegistry.messages.unknownReason"),
      }),
    );
  } catch (error: any) {
    ElMessage.error(
      error?.message || t("endpointRegistry.messages.readinessFailed"),
    );
  } finally {
    setActionLoading(row.id, "");
  }
};

const handlePublish = async (row: EndpointRow) => {
  try {
    await ElMessageBox.confirm(
      t("endpointRegistry.messages.confirmPublishText", { name: row.name }),
      t("endpointRegistry.messages.confirmPublishTitle"),
      { type: "warning" },
    );
    setActionLoading(row.id, "publish");
    await serverAPI.changeApiCenterLifecycleState(row.serverId, { action: "publish" });
    ElMessage.success(t("endpointRegistry.messages.publishSuccess"));
    await loadOverview();
  } catch (error: any) {
    if (error === "cancel" || error === "close") return;
    ElMessage.error(error?.message || t("endpointRegistry.messages.publishFailed"));
  } finally {
    setActionLoading(row.id, "");
  }
};

const handleOffline = async (row: EndpointRow) => {
  try {
    await ElMessageBox.confirm(
      t("endpointRegistry.messages.confirmOfflineText", { name: row.name }),
      t("endpointRegistry.messages.confirmOfflineTitle"),
      { type: "warning" },
    );
    setActionLoading(row.id, "offline");
    await serverAPI.changeApiCenterLifecycleState(row.serverId, { action: "offline" });
    ElMessage.success(t("endpointRegistry.messages.offlineSuccess"));
    await loadOverview();
  } catch (error: any) {
    if (error === "cancel" || error === "close") return;
    ElMessage.error(error?.message || t("endpointRegistry.messages.offlineFailed"));
  } finally {
    setActionLoading(row.id, "");
  }
};

onMounted(async () => {
  const sourceType = route.query.sourceType;
  if (sourceType === "imported" || sourceType === "manual") {
    selectedSourceType.value = sourceType;
  }
  await loadOverview();
});

watch(selectedSourceType, async (value) => {
  await router.replace({
    query: {
      ...route.query,
      sourceType: value,
    },
  });
  await loadOverview();
});
</script>

<style scoped>
.endpoint-registry {
  padding: 20px 24px 24px;
  box-sizing: border-box;
  height: calc(100vh - 60px);
  overflow: auto;
  scrollbar-gutter: stable both-edges;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 16px;
}

.header-actions {
  display: inline-flex;
  gap: 8px;
}

.page-header h1 {
  margin: 0;
  font-size: 24px;
}

.muted {
  margin: 8px 0 0;
  color: #606266;
}

.toolbar-card {
  margin-bottom: 12px;
}

.mb-12 {
  margin-bottom: 12px;
}

.group-title {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.count {
  color: #606266;
}

.row-actions {
  display: flex;
  gap: 4px;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
}

.action-btn {
  min-width: 58px;
  margin-left: 0 !important;
}

:deep(.delete-action-btn.el-button--danger.is-plain) {
  color: #fff;
  background-color: #d64545;
  border-color: #d64545;
}

:deep(.delete-action-btn.el-button--danger.is-plain:hover),
:deep(.delete-action-btn.el-button--danger.is-plain:focus-visible) {
  color: #fff;
  background-color: #bb2f2f;
  border-color: #bb2f2f;
}
</style>
