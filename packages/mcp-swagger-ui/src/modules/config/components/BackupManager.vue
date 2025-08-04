<template>
  <div class="backup-manager">
    <div class="header">
      <h3>配置备份管理</h3>
      <el-button
        type="primary"
        @click="showCreateBackupDialog"
        :icon="FolderAdd"
      >
        创建备份
      </el-button>
    </div>

    <!-- 备份列表 -->
    <div class="backup-list" v-loading="configStore.loading">
      <el-empty
        v-if="configStore.backupList.length === 0"
        description="暂无备份记录"
      >
        <el-button type="primary" @click="showCreateBackupDialog">
          创建第一个备份
        </el-button>
      </el-empty>

      <div v-else>
        <div
          v-for="backup in configStore.backupList"
          :key="backup.id"
          class="backup-item"
        >
          <div class="backup-info">
            <div class="backup-header">
              <h4>{{ backup.name }}</h4>
              <el-tag size="small" type="info">
                {{ formatFileSize(backup.size) }}
              </el-tag>
            </div>

            <div class="backup-meta">
              <div class="meta-item">
                <el-icon><Calendar /></el-icon>
                <span>{{ formatDateTime(backup.timestamp) }}</span>
              </div>
              <div class="meta-item">
                <el-icon><Document /></el-icon>
                <span>{{ backup.types.join(", ") }}</span>
              </div>
            </div>

            <div v-if="backup.description" class="backup-description">
              {{ backup.description }}
            </div>
          </div>

          <div class="backup-actions">
            <el-button
              type="primary"
              size="small"
              @click="restoreBackup(backup.id)"
              :loading="restoringBackupId === backup.id"
            >
              恢复
            </el-button>
            <el-button
              type="danger"
              size="small"
              @click="deleteBackup(backup.id)"
            >
              删除
            </el-button>
          </div>
        </div>
      </div>
    </div>

    <!-- 创建备份对话框 -->
    <el-dialog v-model="createBackupVisible" title="创建配置备份" width="500px">
      <el-form
        ref="backupFormRef"
        :model="backupForm"
        :rules="backupFormRules"
        label-width="100px"
      >
        <el-form-item label="备份名称" prop="name">
          <el-input
            v-model="backupForm.name"
            placeholder="请输入备份名称"
            maxlength="50"
            show-word-limit
          />
        </el-form-item>

        <el-form-item label="备份类型" prop="types">
          <el-checkbox-group v-model="backupForm.types">
            <el-checkbox label="servers">服务器配置</el-checkbox>
            <el-checkbox label="auth">认证配置</el-checkbox>
            <el-checkbox label="openapi">OpenAPI规范</el-checkbox>
            <el-checkbox label="testcases">测试用例</el-checkbox>
            <el-checkbox label="settings">系统设置</el-checkbox>
          </el-checkbox-group>
        </el-form-item>

        <el-form-item label="备份描述">
          <el-input
            v-model="backupForm.description"
            type="textarea"
            :rows="3"
            placeholder="可选：描述本次备份的目的或包含的修改"
            maxlength="200"
            show-word-limit
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="createBackupVisible = false">取消</el-button>
        <el-button
          type="primary"
          @click="createBackup"
          :loading="configStore.loading"
        >
          创建备份
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import {
  ElMessage,
  ElMessageBox,
  type FormInstance,
  type FormRules,
} from "element-plus";
import { FolderAdd, Calendar, Document } from "@element-plus/icons-vue";
import { useConfigStore } from "@/stores/config";

interface BackupForm {
  name: string;
  types: string[];
  description: string;
}

// Store
const configStore = useConfigStore();

// 状态
const createBackupVisible = ref(false);
const restoringBackupId = ref<string | null>(null);

// 表单
const backupFormRef = ref<FormInstance>();
const backupForm = ref<BackupForm>({
  name: "",
  types: [],
  description: "",
});

const backupFormRules: FormRules = {
  name: [
    { required: true, message: "请输入备份名称", trigger: "blur" },
    { min: 2, max: 50, message: "长度在 2 到 50 个字符", trigger: "blur" },
  ],
  types: [
    { required: true, message: "请选择至少一种备份类型", trigger: "change" },
  ],
};

// 方法
const showCreateBackupDialog = () => {
  // 重置表单
  backupForm.value = {
    name: `备份_${new Date().toLocaleDateString()}`,
    types: ["servers", "auth", "openapi", "testcases", "settings"],
    description: "",
  };
  createBackupVisible.value = true;
};

const createBackup = async () => {
  if (!backupFormRef.value) return;

  try {
    await backupFormRef.value.validate();

    await configStore.createBackup(
      backupForm.value.name,
      backupForm.value.types,
      backupForm.value.description,
    );

    createBackupVisible.value = false;
  } catch (error) {
    if (error !== false) {
      // 验证失败时error为false
      console.error("创建备份失败:", error);
    }
  }
};

const restoreBackup = async (backupId: string) => {
  try {
    await ElMessageBox.confirm(
      "恢复备份将会覆盖当前配置，此操作无法撤销。是否继续？",
      "确认恢复备份",
      {
        confirmButtonText: "确认恢复",
        cancelButtonText: "取消",
        type: "warning",
      },
    );

    restoringBackupId.value = backupId;
    const success = await configStore.restoreBackup(backupId);

    if (success) {
      ElMessage.success("备份恢复成功");
    }
  } catch (error) {
    if (error !== "cancel") {
      console.error("恢复备份失败:", error);
    }
  } finally {
    restoringBackupId.value = null;
  }
};

const deleteBackup = async (backupId: string) => {
  try {
    await ElMessageBox.confirm(
      "确定要删除这个备份吗？此操作无法撤销。",
      "确认删除",
      {
        confirmButtonText: "确认删除",
        cancelButtonText: "取消",
        type: "warning",
      },
    );

    await configStore.deleteBackup(backupId);
  } catch (error) {
    if (error !== "cancel") {
      console.error("删除备份失败:", error);
    }
  }
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

onMounted(() => {
  // 组件挂载时可以刷新备份列表
});
</script>

<style scoped>
.backup-manager {
  padding: 20px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.header h3 {
  margin: 0;
  color: var(--el-text-color-primary);
}

.backup-list {
  min-height: 400px;
}

.backup-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  margin-bottom: 16px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  transition: all 0.3s ease;
}

.backup-item:hover {
  border-color: var(--el-color-primary);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.backup-info {
  flex: 1;
}

.backup-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.backup-header h4 {
  margin: 0;
  color: var(--el-text-color-primary);
  font-size: 16px;
  font-weight: 600;
}

.backup-meta {
  display: flex;
  gap: 20px;
  margin-bottom: 8px;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--el-text-color-regular);
  font-size: 13px;
}

.backup-description {
  color: var(--el-text-color-secondary);
  font-size: 13px;
  line-height: 1.5;
  margin-top: 8px;
}

.backup-actions {
  display: flex;
  gap: 8px;
}

.el-checkbox-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.el-checkbox-group .el-checkbox {
  margin-right: 0;
}
</style>
