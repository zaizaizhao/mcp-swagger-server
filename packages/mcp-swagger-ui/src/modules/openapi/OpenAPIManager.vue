<template>
  <div class="openapi-manager">
    <!-- 认证检查加载状态 -->
    <div
      v-if="authChecking"
      class="auth-loading"
      style="
        height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
      "
    >
      <div style="text-align: center">
        <el-icon size="48" class="is-loading" style="margin-bottom: 16px">
          <Loading />
        </el-icon>
        <p style="color: #606266; margin: 0">{{ t("openapi.checkingAuth") }}</p>
      </div>
    </div>

    <!-- 未认证状态 -->
    <div
      v-else-if="!isAuthenticated"
      class="auth-required"
      style="
        height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
      "
    >
      <el-result
        icon="warning"
        :title="t('openapi.authRequired')"
        :sub-title="t('openapi.pleaseLogin')"
      >
        <template #extra>
          <el-button type="primary" @click="checkAuthentication">
            {{ t("openapi.retryAuth") }}
          </el-button>
        </template>
      </el-result>
    </div>

    <!-- 已认证状态 - 正常页面内容 -->
    <template v-else>
      <!-- 页面头部 -->
      <div class="header-section">
        <div class="header-content">
          <h1>
            <el-icon><Document /></el-icon>
            {{ t("openapi.title") }}
          </h1>
          <p class="header-description">{{ t("openapi.description") }}</p>
        </div>
        <div class="header-actions">
          <el-button
            type="primary"
            @click="showUploadDialog = true"
            :icon="Upload"
          >
            {{ t("openapi.uploadFile") }}
          </el-button>
          <el-button type="success" @click="showUrlDialog = true" :icon="Link">
            {{ t("openapi.importFromUrl") }}
          </el-button>
          <el-button
            @click="refreshDocuments"
            :loading="loading"
            :icon="Refresh"
          >
            {{ t("common.refresh") }}
          </el-button>
        </div>
      </div>

      <!-- 主要内容区域 -->
      <div class="manager-content">
        <el-row :gutter="24" style="height: calc(100vh - 80px)">
          <!-- 左侧：文档列表 -->
          <el-col :span="8">
            <el-card
              shadow="always"
              class="document-list-card"
              style="height: 100%"
            >
              <template #header>
                <div class="list-header">
                  <span>
                    <el-icon><Folder /></el-icon>
                    {{ t("openapi.specList") }} ({{ documents.length }})
                  </span>
                </div>
              </template>

              <!-- 搜索框 -->
              <div class="search-container">
                <el-input
                  v-model="searchQuery"
                  :placeholder="t('openapi.searchPlaceholder')"
                  clearable
                  size="small"
                >
                  <template #prefix>
                    <el-icon><Search /></el-icon>
                  </template>
                </el-input>
              </div>

              <!-- 文档列表 -->
              <div class="document-list">
                <el-empty
                  v-if="!filteredDocuments.length"
                  :description="t('openapi.noSpecs')"
                />
                <div v-else class="document-items">
                  <div
                    v-for="doc in filteredDocuments"
                    :key="doc.id"
                    class="document-item"
                    :class="{ active: selectedDocument?.id === doc.id }"
                    @click="selectDocument(doc)"
                  >
                    <div class="document-info">
                      <div class="document-header">
                        <div class="document-name">{{ doc.name }}</div>
                        <span class="upload-time">{{
                          formatDate(doc.updatedAt)
                        }}</span>
                      </div>
                      <div class="document-meta">
                        <DocumentStatusProgress
                          :status="
                            doc.status as
                              | 'valid'
                              | 'invalid'
                              | 'pending'
                              | 'unknown'
                          "
                          size="small"
                        />
                      </div>
                    </div>
                    <div class="document-actions">
                      <div class="action-buttons">
                        <el-button size="small" @click.stop="editDocument(doc)">
                          <el-icon><Edit /></el-icon>
                        </el-button>
                        <el-button
                          size="small"
                          @click.stop="deleteDocument(doc.id)"
                        >
                          <el-icon><Delete /></el-icon>
                        </el-button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </el-card>
          </el-col>

          <!-- 右侧：文档详情 -->
          <el-col :span="16">
            <el-card shadow="always" class="detail-card" style="height: 100%">
              <template #header>
                <div class="detail-header" v-if="selectedDocument">
                  <span>
                    <el-icon><Document /></el-icon>
                    {{ selectedDocument.name }}
                  </span>
                  <div class="detail-controls">
                    <el-button-group>
                      <el-button
                        :type="activeTab === 'editor' ? 'primary' : ''"
                        size="small"
                        @click="activeTab = 'editor'"
                      >
                        <el-icon><Edit /></el-icon>
                        {{ t("common.edit") }}
                      </el-button>

                      <el-button
                        :type="activeTab === 'apis' ? 'primary' : ''"
                        size="small"
                        @click="activeTab = 'apis'"
                        :disabled="selectedDocument.status !== 'valid'"
                      >
                        <el-icon><Operation /></el-icon>
                        {{ t("openapi.paths") }}
                      </el-button>
                      <el-button
                        :type="activeTab === 'tools' ? 'primary' : ''"
                        size="small"
                        @click="activeTab = 'tools'"
                        :disabled="selectedDocument.status !== 'valid'"
                      >
                        <el-icon><Tools /></el-icon>
                        {{ t("openapi.tools") }}
                      </el-button>
                    </el-button-group>
                    <el-divider direction="vertical" />
                    <el-button
                      size="small"
                      @click="validateSpec"
                      :disabled="!selectedDocument || !editorContent.trim()"
                      :loading="validating"
                    >
                      <el-icon><Check /></el-icon>
                      {{ t("openapi.validateSpec") }}
                    </el-button>
                    <el-button
                      size="small"
                      type="success"
                      @click="saveDocumentContent"
                      :disabled="
                        !selectedDocument ||
                        !editorContent.trim() ||
                        !isAuthenticated
                      "
                      :loading="saving"
                    >
                      <el-icon><DocumentCopy /></el-icon>
                      {{ t("openapi.saveDocument") }}
                    </el-button>
                    <el-button
                      type="primary"
                      size="small"
                      @click="convertToMCP"
                      :disabled="selectedDocument.status !== 'valid'"
                    >
                      <el-icon><Setting /></el-icon>
                      {{ t("openapi.convertToMcp") }}
                    </el-button>
                    <el-button
                      type="primary"
                      size="small"
                      @click="downloadSpec"
                      :disabled="selectedDocument.status !== 'valid'"
                    >
                      <el-icon><Download /></el-icon>
                      {{ t("common.download") }}
                    </el-button>
                  </div>
                </div>
                <div v-else class="empty-header">
                  <span>
                    <el-icon><Document /></el-icon>
                    {{ t("openapi.selectDocument") }}
                  </span>
                </div>
              </template>

              <div
                class="detail-content"
                style="height: calc(100% - 60px); overflow: hidden"
              >
                <!-- 空状态 -->
                <div
                  v-if="!selectedDocument"
                  class="empty-state"
                  style="
                    height: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                  "
                >
                  <el-empty
                    :description="t('openapi.selectDocument')"
                    :image-size="150"
                  >
                    <el-button
                      type="primary"
                      @click="showUploadDialog = true"
                      :icon="Upload"
                    >
                      {{ t("openapi.uploadFile") }}
                    </el-button>
                  </el-empty>
                </div>

                <!-- 错误状态 -->
                <div
                  v-else-if="
                    selectedDocument.status === 'invalid' &&
                    activeTab !== 'editor'
                  "
                  class="error-state"
                  style="
                    height: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                  "
                >
                  <el-result
                    icon="error"
                    :title="t('openapi.parseFailed')"
                    :sub-title="
                      selectedDocument.metadata?.validationErrors?.[0] ||
                      t('openapi.validationFailed')
                    "
                  >
                    <template #extra>
                      <el-button type="primary" @click="activeTab = 'editor'">
                        <el-icon><Edit /></el-icon>
                        {{ t("openapi.editDocument") }}
                      </el-button>
                      <el-button @click="deleteDocument(selectedDocument.id)">
                        <el-icon><Delete /></el-icon>
                        {{ t("openapi.deleteSpec") }}
                      </el-button>
                    </template>
                  </el-result>
                </div>

                <!-- 加载状态 -->
                <div
                  v-else-if="selectedDocument.status === 'pending'"
                  class="loading-state"
                  style="
                    height: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                  "
                >
                  <div style="text-align: center">
                    <el-icon
                      size="48"
                      class="is-loading"
                      style="margin-bottom: 16px"
                    >
                      <Loading />
                    </el-icon>
                    <p style="color: #606266; margin: 0">
                      {{ t("openapi.parsing") }}
                    </p>
                  </div>
                </div>

                <!-- 正常状态或编辑状态 -->
                <div v-else class="content-tabs" style="height: 100%">
                  <div
                    v-show="activeTab === 'editor'"
                    ref="editorContainerRef"
                    class="editor-container"
                    style="height: 100%; position: relative"
                  >
                    <!-- 验证错误提示 -->
                    <div
                      v-if="
                        selectedDocument.status === 'invalid' &&
                        validationResults &&
                        !validationResults.valid
                      "
                      class="validation-errors"
                      style="
                        position: absolute;
                        top: 0;
                        left: 0;
                        right: 0;
                        z-index: 10;
                        background: #fff;
                        border-bottom: 1px solid #dcdfe6;
                        padding: 12px;
                      "
                    >
                      <el-alert
                        :title="t('openapi.validationErrors')"
                        type="error"
                        :closable="false"
                        show-icon
                      >
                        <template #default>
                          <div
                            class="error-list"
                            style="max-height: 120px; overflow-y: auto"
                          >
                            <div
                              v-for="(error, index) in validationResults.errors"
                              :key="index"
                              class="error-item"
                              style="margin-bottom: 4px; font-size: 12px"
                            >
                              {{ error }}
                            </div>
                          </div>
                        </template>
                      </el-alert>
                    </div>
                    <MonacoEditor
                      v-model="editorContent"
                      :language="detectLanguage(editorContent)"
                      :height="
                        selectedDocument.status === 'invalid' &&
                        validationResults?.valid === false
                          ? Math.max(editorHeight - 160, 300)
                          : editorHeight
                      "
                      :options="editorOptions"
                      @change="handleContentChange"
                      :style="{
                        marginTop:
                          selectedDocument.status === 'invalid' &&
                          validationResults?.valid === false
                            ? '160px'
                            : '0',
                      }"
                    />
                  </div>

                  <div
                    v-show="activeTab === 'apis'"
                    class="apis-container"
                    style="height: 100%; overflow-y: auto"
                  >
                    <el-empty
                      v-if="!parsedApis.length"
                      :description="t('openapi.noParseResult')"
                    />
                    <div v-else class="api-list">
                      <!-- API卡片列表 -->
                      <div
                        v-for="(api, index) in parsedApis"
                        :key="`${api.method}-${api.path}-${index}`"
                        class="api-card"
                        :class="`api-card--${api.method.toLowerCase()}`"
                      >
                        <div
                          class="api-card__header"
                          @click="toggleApiDetail(index)"
                        >
                          <div class="api-card__method-info">
                            <span
                              class="api-method-tag"
                              :class="`method-${api.method.toLowerCase()}`"
                            >
                              {{ api.method.toUpperCase() }}
                            </span>
                            <span class="api-path">{{ api.path }}</span>
                          </div>
                          <div class="api-card__summary">
                            <span class="api-summary">{{
                              api.summary ||
                              api.description ||
                              t("openapi.noDescription")
                            }}</span>
                            <el-icon
                              class="expand-icon"
                              :class="{
                                expanded: expandedApis.includes(index),
                              }"
                            >
                              <ArrowDown />
                            </el-icon>
                          </div>
                        </div>

                        <!-- 可展开的详细信息 -->
                        <el-collapse-transition>
                          <div
                            v-show="expandedApis.includes(index)"
                            class="api-card__details"
                          >
                            <div class="api-detail-section">
                              <div
                                v-if="
                                  api.description &&
                                  api.description !== api.summary
                                "
                                class="detail-item"
                              >
                                <label>{{ t("openapi.description") }}：</label>
                                <span>{{ api.description }}</span>
                              </div>

                              <div v-if="api.operationId" class="detail-item">
                                <label>{{ t("openapi.operationId") }}：</label>
                                <span>{{ api.operationId }}</span>
                              </div>

                              <div
                                v-if="api.tags && api.tags.length"
                                class="detail-item"
                              >
                                <label>{{ t("openapi.tags") }}：</label>
                                <div class="tag-list">
                                  <el-tag
                                    v-for="tag in api.tags"
                                    :key="tag"
                                    size="small"
                                    effect="plain"
                                    class="api-tag"
                                  >
                                    {{ tag }}
                                  </el-tag>
                                </div>
                              </div>

                              <div
                                v-if="api.parameters && api.parameters.length"
                                class="detail-item"
                              >
                                <label>{{ t("openapi.parameters") }}：</label>
                                <div class="parameter-list">
                                  <div
                                    v-for="param in api.parameters"
                                    :key="param.name"
                                    class="parameter-item"
                                  >
                                    <span class="param-name">{{
                                      param.name
                                    }}</span>
                                    <span class="param-type">{{
                                      param.type ||
                                      param.schema?.type ||
                                      "unknown"
                                    }}</span>
                                    <span
                                      v-if="param.required"
                                      class="param-required"
                                      >{{ t("tester.required") }}</span
                                    >
                                  </div>
                                </div>
                              </div>

                              <div v-if="api.responses" class="detail-item">
                                <label>{{ t("openapi.responses") }}：</label>
                                <div class="response-list">
                                  <div
                                    v-for="(response, code) in api.responses"
                                    :key="code"
                                    class="response-item"
                                  >
                                    <span
                                      class="response-code"
                                      :class="
                                        getResponseCodeClass(String(code))
                                      "
                                      >{{ code }}</span
                                    >
                                    <span class="response-desc">{{
                                      response.description ||
                                      t("openapi.noDescription")
                                    }}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </el-collapse-transition>
                      </div>
                    </div>
                  </div>

                  <div
                    v-show="activeTab === 'tools'"
                    class="tools-container"
                    style="height: 100%; overflow-y: auto"
                  >
                    <MCPToolPreview
                      :tools="mcpTools"
                      :serverUrl="mcpServerUrl"
                    />
                  </div>
                </div>
              </div>
            </el-card>
          </el-col>
        </el-row>
      </div>

      <!-- 创建规范对话框 -->
      <el-dialog
        v-model="showCreateDialog"
        :title="t('openapi.createSpec')"
        width="600px"
        align-center
      >
        <el-form
          ref="createFormRef"
          :model="createForm"
          :rules="createFormRules"
          label-width="100px"
        >
          <el-form-item :label="t('openapi.specName')" prop="name">
            <el-input
              v-model="createForm.name"
              :placeholder="t('openapi.enterSpecName')"
              clearable
            />
          </el-form-item>

          <el-form-item :label="t('openapi.specVersion')" prop="version">
            <el-input
              v-model="createForm.version"
              :placeholder="t('openapi.enterVersion')"
              clearable
            />
          </el-form-item>

          <el-form-item
            :label="t('openapi.specDescription')"
            prop="description"
          >
            <el-input
              v-model="createForm.description"
              type="textarea"
              :rows="3"
              :placeholder="t('openapi.enterDescription')"
            />
          </el-form-item>

          <el-form-item :label="t('openapi.template')">
            <el-select
              v-model="createForm.template"
              :placeholder="t('openapi.selectTemplate')"
              clearable
              style="width: 100%"
            >
              <el-option :label="t('openapi.blankTemplate')" value="blank" />
              <el-option
                :label="t('openapi.basicRestTemplate')"
                value="basic-rest"
              />
              <el-option
                :label="t('openapi.ecommerceTemplate')"
                value="ecommerce"
              />
              <el-option
                :label="t('openapi.userManagementTemplate')"
                value="user-management"
              />
            </el-select>
          </el-form-item>
        </el-form>

        <template #footer>
          <el-button @click="showCreateDialog = false">{{
            t("common.cancel")
          }}</el-button>
          <el-button type="primary" @click="createNewSpec" :loading="creating">
            {{ t("common.create") }}
          </el-button>
        </template>
      </el-dialog>

      <!-- 上传对话框 -->
      <el-dialog
        v-model="showUploadDialog"
        :title="t('openapi.uploadFile')"
        width="600px"
        :before-close="handleUploadDialogClose"
      >
        <div class="upload-container">
          <el-upload
            ref="uploadRef"
            class="upload-demo"
            drag
            :auto-upload="false"
            :on-change="handleFileChange"
            :on-remove="handleFileRemove"
            :file-list="uploadFileList"
            :accept="'.json,.yaml,.yml'"
            :limit="1"
          >
            <el-icon class="el-icon--upload" size="48" style="color: #409eff"
              ><UploadFilled
            /></el-icon>
            <div
              class="el-upload__text"
              style="font-size: 16px; margin-top: 16px"
            >
              {{ t("openapi.dragOrClick") }}
            </div>
            <template #tip>
              <div
                class="el-upload__tip"
                style="margin-top: 12px; color: #909399"
              >
                {{ t("openapi.supportedFormats") }}
              </div>
            </template>
          </el-upload>

          <el-form
            v-if="uploadFile"
            ref="uploadFormRef"
            :model="uploadForm"
            :rules="uploadRules"
            label-width="100px"
            class="upload-form"
          >
            <el-form-item :label="t('openapi.docName')" prop="name">
              <el-input
                v-model="uploadForm.name"
                :placeholder="t('openapi.enterDocName')"
                size="large"
              >
                <template #prefix>
                  <el-icon><Document /></el-icon>
                </template>
              </el-input>
            </el-form-item>
            <el-form-item
              :label="t('openapi.docDescription')"
              prop="description"
            >
              <el-input
                v-model="uploadForm.description"
                type="textarea"
                :rows="3"
                :placeholder="t('openapi.enterDocDescription')"
                size="large"
              />
            </el-form-item>
          </el-form>
        </div>

        <template #footer>
          <div class="dialog-footer">
            <el-button @click="handleUploadDialogClose" size="large">{{
              t("common.cancel")
            }}</el-button>
            <el-button
              type="primary"
              @click="confirmUpload"
              :disabled="!uploadFile"
              size="large"
              :loading="uploading"
            >
              {{
                uploading ? t("openapi.uploading") : t("openapi.confirmUpload")
              }}
            </el-button>
          </div>
        </template>
      </el-dialog>

      <!-- URL导入对话框 -->
      <el-dialog
        v-model="showUrlDialog"
        :title="t('openapi.importFromUrl')"
        width="600px"
        align-center
      >
        <el-form
          ref="urlFormRef"
          :model="urlForm"
          :rules="urlFormRules"
          label-width="100px"
        >
          <el-form-item :label="t('openapi.docUrl')" prop="url">
            <el-input
              v-model="urlForm.url"
              :placeholder="t('openapi.enterDocUrl')"
              clearable
              size="large"
            >
              <template #prefix>
                <el-icon><Link /></el-icon>
              </template>
            </el-input>
            <div class="form-tip">
              {{ t("openapi.urlFormats") }}
            </div>
          </el-form-item>

          <el-form-item :label="t('openapi.docName')" prop="name">
            <el-input
              v-model="urlForm.name"
              :placeholder="t('openapi.enterDocName')"
              clearable
              size="large"
            >
              <template #prefix>
                <el-icon><Edit /></el-icon>
              </template>
            </el-input>
            <div class="form-tip">
              {{ t("openapi.autoNameTip") }}
            </div>
          </el-form-item>

          <el-form-item :label="t('auth.authType')">
            <el-select
              v-model="urlForm.authType"
              :placeholder="t('auth.selectAuthType')"
              size="large"
              style="width: 100%"
            >
              <el-option :label="t('auth.noAuth')" value="none" />
              <el-option :label="t('auth.bearerToken')" value="bearer" />
              <el-option :label="t('auth.basicAuth')" value="basic" />
            </el-select>
          </el-form-item>

          <el-form-item
            v-if="urlForm.authType === 'bearer'"
            :label="t('auth.token')"
          >
            <el-input
              v-model="urlForm.token"
              type="password"
              :placeholder="t('auth.enterToken')"
              show-password
              size="large"
            />
          </el-form-item>

          <template v-if="urlForm.authType === 'basic'">
            <el-form-item :label="t('auth.username')">
              <el-input
                v-model="urlForm.username"
                :placeholder="t('auth.enterUsername')"
                size="large"
              />
            </el-form-item>

            <el-form-item :label="t('auth.password')">
              <el-input
                v-model="urlForm.password"
                type="password"
                :placeholder="t('auth.enterPassword')"
                show-password
                size="large"
              />
            </el-form-item>
          </template>
        </el-form>

        <template #footer>
          <div class="dialog-footer">
            <el-button @click="showUrlDialog = false" size="large">{{
              t("common.cancel")
            }}</el-button>
            <el-button
              type="primary"
              @click="importFromUrl"
              :loading="importing"
              size="large"
            >
              {{
                importing ? t("openapi.importing") : t("openapi.startImport")
              }}
            </el-button>
          </div>
        </template>
      </el-dialog>

      <!-- 编辑文档对话框 -->
      <el-dialog
        v-model="showEditDialog"
        :title="t('openapi.editDocument')"
        width="600px"
        align-center
      >
        <el-form
          ref="editFormRef"
          :model="editForm"
          :rules="editFormRules"
          label-width="100px"
        >
          <el-form-item :label="t('openapi.docName')" prop="name">
            <el-input
              v-model="editForm.name"
              :placeholder="t('openapi.enterDocName')"
              clearable
              size="large"
            >
              <template #prefix>
                <el-icon><Document /></el-icon>
              </template>
            </el-input>
          </el-form-item>

          <el-form-item :label="t('openapi.docDescription')" prop="description">
            <el-input
              v-model="editForm.description"
              type="textarea"
              :rows="4"
              :placeholder="t('openapi.enterDocDescription')"
              size="large"
            />
          </el-form-item>
        </el-form>

        <template #footer>
          <div class="dialog-footer">
            <el-button @click="showEditDialog = false" size="large">{{
              t("common.cancel")
            }}</el-button>
            <el-button
              type="primary"
              @click="saveEditDocument"
              :loading="editing"
              size="large"
            >
              {{ editing ? t("openapi.saving") : t("common.save") }}
            </el-button>
          </div>
        </template>
      </el-dialog>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { useI18n } from "vue-i18n";
import {
  Plus,
  Upload,
  Link,
  Search,
  MoreFilled,
  Edit,
  DocumentCopy,
  Download,
  Delete,
  Operation,
  Tools,
  Check,
  DocumentChecked,
  UploadFilled,
  Folder,
  Setting,
  Refresh,
  ArrowDown,
} from "@element-plus/icons-vue";
import type { UploadFile, FormInstance } from "element-plus";
import MonacoEditor from "../../shared/components/monaco/MonacoEditor.vue";
import DocumentStatusProgress from "../../components/DocumentStatusProgress.vue";

import MCPToolPreview from "./components/openapi/MCPToolPreview.vue";
import type { OpenAPISpec, ValidationResult, MCPTool } from "../../types";
import { useOpenAPIStore } from "../../stores/openapi";
import {
  parseOpenAPI,
  validateOpenAPI,
  extractApiPaths,
} from "../../utils/openapi";
import {
  documentsApi,
  type Document,
  type CreateDocumentDto,
  type UpdateDocumentDto,
} from "../../api/documents";

// 导入全局功能
import { useConfirmation } from "../../composables/useConfirmation";
import { useFormValidation } from "../../composables/useFormValidation";
import { usePerformanceMonitor } from "../../composables/usePerformance";

// 国际化
const { t } = useI18n();
// import LoadingOverlay from '@/shared/components/ui/LoadingOverlay.vue' // 暂时注释掉，如果需要可以创建这个组件

// 状态管理
const openApiStore = useOpenAPIStore();

// 全局功能
const {
  confirmDelete: globalConfirmDelete,
  confirmDangerousAction,
  confirmSave,
} = useConfirmation();

const { startMonitoring, stopMonitoring, measureFunction } =
  usePerformanceMonitor();

// 响应式数据
const specsLoading = ref(false);
const loading = ref(false);
const searchQuery = ref("");
const selectedDocument = ref<Document | null>(null);
const activeTab = ref<"editor" | "apis" | "tools">("editor");
const editorContent = ref("");
const saving = ref(false);
const validating = ref(false);
const converting = ref(false);
const validationResults = ref<ValidationResult | null>(null);
const mcpTools = ref<any[]>([]); // MCP工具列表
const mcpServerUrl = ref("");
const documents = ref<Document[]>([]); // 文档列表
const parsedApis = ref<any[]>([]); // 解析的API列表
const uploadFile = ref<File | null>(null);
const editorContainerRef = ref<HTMLElement>(); // 编辑器容器引用
const expandedApis = ref<number[]>([]); // 展开的API卡片索引列表
const isAuthenticated = ref(false); // 用户认证状态
const authChecking = ref(true); // 认证检查状态

// 对话框状态
const showCreateDialog = ref(false);
const showUploadDialog = ref(false);
const showUrlDialog = ref(false);
const showEditDialog = ref(false);
const creating = ref(false);
const uploading = ref(false);
const importing = ref(false);
const editing = ref(false);

// 表单引用
const createFormRef = ref<FormInstance>();
const urlFormRef = ref<FormInstance>();
const uploadRef = ref();
const editFormRef = ref<FormInstance>();

// 上传文件列表
const uploadFileList = ref<UploadFile[]>([]);

// 表单数据
const createForm = ref({
  name: "",
  version: "1.0.0",
  description: "",
  template: "",
});

const uploadForm = ref({
  name: "",
  description: "",
});

const urlForm = ref({
  url: "",
  name: "",
  authType: "none",
  token: "",
  username: "",
  password: "",
});

const editForm = ref({
  id: "",
  name: "",
  description: "",
});

// 表单验证规则
const createFormRules = {
  name: [
    {
      required: true,
      message: t("openapi.validation.specNameRequired"),
      trigger: "blur",
    },
    {
      min: 2,
      max: 50,
      message: t("openapi.validation.nameLength"),
      trigger: "blur",
    },
  ],
  version: [
    {
      required: true,
      message: t("openapi.validation.versionRequired"),
      trigger: "blur",
    },
  ],
};

const uploadRules = {
  name: [
    {
      required: true,
      message: t("openapi.validation.docNameRequired"),
      trigger: "blur",
    },
    {
      min: 2,
      max: 50,
      message: t("openapi.validation.nameLength"),
      trigger: "blur",
    },
  ],
};

const urlFormRules = {
  url: [
    {
      required: true,
      message: t("openapi.validation.urlRequired"),
      trigger: "blur",
    },
    {
      type: "url",
      message: t("openapi.validation.urlInvalid"),
      trigger: "blur",
    },
  ],
  name: [
    {
      required: true,
      message: t("openapi.validation.specNameRequired"),
      trigger: "blur",
    },
  ],
};

const editFormRules = {
  name: [
    {
      required: true,
      message: t("openapi.validation.docNameRequired"),
      trigger: "blur",
    },
    {
      min: 2,
      max: 50,
      message: t("openapi.validation.nameLength"),
      trigger: "blur",
    },
  ],
};

// Monaco编辑器选项
const editorOptions: any = {
  theme: "vs-dark",
  fontSize: 14,
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  automaticLayout: true,
  tabSize: 2,
  wordWrap: "on" as const,
  // 支持大型文件
  largeFileOptimizations: false,
  // 大幅增加内容长度限制 - 提升到更大的值
  maxTokenizationLineLength: 500000,
  // 提高渲染性能
  renderValidationDecorations: "on",
  // 支持更多行数渲染 - 大幅提升行数限制
  stopRenderingLineAfter: 200000,
  // 禁用语法检查以提高性能
  validate: false,
  // 增加滚动性能
  smoothScrolling: true,
  // 禁用不必要的功能以提高性能
  folding: false,
  lineNumbers: "on",
  // 增加更多大文件支持配置
  scrollbar: {
    vertical: "auto",
    horizontal: "auto",
    handleMouseWheel: true,
  },
  // 禁用代码折叠以提高性能
  glyphMargin: false,
  // 优化大文件渲染
  renderLineHighlight: "none",
};

// 计算属性
const filteredDocuments = computed(() => {
  if (!searchQuery.value) return documents.value;

  const query = searchQuery.value.toLowerCase();
  return documents.value.filter(
    (doc) =>
      doc.name.toLowerCase().includes(query) ||
      doc.description?.toLowerCase().includes(query),
  );
});

// 计算编辑器高度
const editorHeight = computed(() => {
  // 如果容器引用存在，动态计算可用高度
  if (editorContainerRef.value) {
    const containerHeight = editorContainerRef.value.clientHeight;
    // 减去一些边距和其他元素的高度
    return Math.max(containerHeight - 20, 300); // 最小高度300px
  }
  // 默认使用视窗高度的计算值
  return Math.max(window.innerHeight - 300, 400);
});

// 方法
// 检查用户认证状态
const checkAuthentication = async () => {
  try {
    authChecking.value = true;
    console.log("Starting authentication check...");

    isAuthenticated.value = await documentsApi.checkAuth();
    console.log("Authentication result:", isAuthenticated.value);

    if (isAuthenticated.value) {
      console.log("User authenticated, loading documents...");
      await loadDocuments();
    } else {
      console.log("User not authenticated, clearing document list");
      documents.value = [];
    }
  } catch (error) {
    console.error("Authentication check failed:", error);
    isAuthenticated.value = false;
    documents.value = [];
  } finally {
    authChecking.value = false;
    console.log("Authentication check completed");
  }
};

// 加载文档列表
const loadDocuments = async () => {
  try {
    loading.value = true;
    console.log("Loading documents...");

    const docs = await documentsApi.getDocuments();
    console.log(docs);

    documents.value = docs;

    //console.log(`Successfully loaded ${docs.length} documents:`, docs.map(d => ({ id: d.id, name: d.name })))
  } catch (error: any) {
    console.error("Failed to load documents:", error);
    console.error("Error details:", {
      status: error.response?.status,
      statusText: error.response?.statusText,
      message: error.message,
      url: error.config?.url,
    });

    ElMessage.error(t("openapi.loadDocumentsFailed"));
    documents.value = [];
  } finally {
    loading.value = false;
    console.log("Document loading completed");
  }
};

const detectLanguage = (content: string) => {
  if (!content.trim()) return "yaml";

  try {
    JSON.parse(content);
    return "json";
  } catch {
    return "yaml";
  }
};

const formatDate = (date: Date | string) => {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(dateObj);
};

const selectDocument = async (doc: Document) => {
  if (!isAuthenticated.value) {
    ElMessage.error(t("openapi.authRequired"));
    return;
  }

  // 设置加载状态
  loading.value = true;
  selectedDocument.value = doc;
  editorContent.value = "";
  validationResults.value = null;
  activeTab.value = "editor";

  // 清空之前的解析数据
  parsedApis.value = [];
  mcpTools.value = [];
  mcpServerUrl.value = "";

  try {
    // 调用API获取完整的文档内容
    const fullDocument = await documentsApi.getDocument(doc.id);

    // 更新选中的文档和编辑器内容
    selectedDocument.value = fullDocument;
    editorContent.value = fullDocument.content || "";

    // 自动解析OpenAPI内容并填充数据
    if (fullDocument.content && fullDocument.content.trim()) {
      try {
        // 解析API路径和详细信息
        const { data: parsedData } = parseOpenAPI(fullDocument.content);
        if (parsedData && parsedData.paths) {
          const apis: any[] = [];
          Object.entries(parsedData.paths).forEach(
            ([path, pathItem]: [string, any]) => {
              if (!pathItem || typeof pathItem !== "object") return;

              const methods = [
                "get",
                "post",
                "put",
                "delete",
                "patch",
                "head",
                "options",
              ];
              methods.forEach((method) => {
                if (pathItem[method]) {
                  const operation = pathItem[method];
                  apis.push({
                    id: apis.length,
                    method: method.toUpperCase(),
                    path,
                    summary: operation.summary || "",
                    description: operation.description || "",
                    operationId: operation.operationId,
                    tags: operation.tags || [],
                    parameters: operation.parameters || [],
                    responses: operation.responses || {},
                  });
                }
              });
            },
          );
          parsedApis.value = apis;
        } else {
          parsedApis.value = [];
        }

        // 解析MCP工具
        try {
          const parseResult = await openApiStore.parseOpenAPIContent(
            fullDocument.content,
          );
          mcpTools.value = parseResult.tools || [];
          mcpServerUrl.value = parseResult.servers[0]?.url || "";
        } catch (mcpError) {
          console.warn("解析MCP工具失败:", mcpError);
          mcpTools.value = [];
          mcpServerUrl.value = "";
        }

        // 保持在编辑标签页，不自动切换
        // if (parsedApis.value.length > 0) {
        //   activeTab.value = 'apis'
        // }
      } catch (parseError) {
        console.error("解析OpenAPI内容失败:", parseError);
        ElMessage.warning(t("openapi.parseContentFailed"));
        parsedApis.value = [];
        mcpTools.value = [];
        mcpServerUrl.value = "";
      }
    }
  } catch (error) {
    console.error("获取文档内容失败:", error);
    ElMessage.error(
      t("openapi.fetchDocumentFailed", {
        error:
          error instanceof Error ? error.message : t("common.unknownError"),
      }),
    );

    // 重置状态
    selectedDocument.value = null;
    editorContent.value = "";
    parsedApis.value = [];
    mcpTools.value = [];
    mcpServerUrl.value = "";
  } finally {
    loading.value = false;
  }
};

const editDocument = (doc: Document) => {
  // 填充编辑表单数据
  editForm.value = {
    id: doc.id,
    name: doc.name,
    description: doc.description || "",
  };
  showEditDialog.value = true;
};

const deleteDocument = async (docId: string) => {
  if (!isAuthenticated.value) {
    ElMessage.error(t("openapi.authRequired"));
    return;
  }

  try {
    // 查找要删除的文档
    const docToDelete = documents.value.find((doc) => doc.id === docId);
    if (!docToDelete) {
      ElMessage.error(t("openapi.documentNotFound"));
      return;
    }

    // 显示确认对话框，包含文档名称
    const confirmed = await ElMessageBox.confirm(
      t("openapi.confirmDeleteDocument", { name: docToDelete.name }),
      t("openapi.confirmDelete"),
      {
        confirmButtonText: t("common.confirm"),
        cancelButtonText: t("common.cancel"),
        type: "warning",
        center: true,
      },
    )
      .then(() => true)
      .catch(() => false);
    if (!confirmed) return;

    // 调用API删除文档
    await documentsApi.deleteDocument(docId);

    // 从本地文档列表中删除
    documents.value = documents.value.filter((doc) => doc.id !== docId);

    // 如果删除的是当前选中的文档，清空相关状态
    if (selectedDocument.value?.id === docId) {
      selectedDocument.value = null;
      editorContent.value = "";
      validationResults.value = null;
      parsedApis.value = [];
      expandedApis.value = [];
      activeTab.value = "editor";
    }

    ElMessage.success(t("openapi.deleteSuccess", { name: docToDelete.name }));
  } catch (error) {
    console.error("删除文档失败:", error);
    ElMessage.error(
      t("openapi.deleteFailed", {
        error:
          error instanceof Error ? error.message : t("common.unknownError"),
      }),
    );
  }
};

const saveEditDocument = async () => {
  if (!editFormRef.value || !isAuthenticated.value) {
    if (!isAuthenticated.value) {
      ElMessage.error(t("openapi.authRequired"));
    }
    return;
  }

  try {
    const valid = await editFormRef.value.validate();
    if (!valid) return;

    editing.value = true;

    // 准备更新数据
    const updateData: UpdateDocumentDto = {
      name: editForm.value.name,
      description: editForm.value.description,
    };

    // 调用API更新文档
    const updatedDoc = await documentsApi.updateDocument(
      editForm.value.id,
      updateData,
    );

    // 更新本地文档列表
    const docIndex = documents.value.findIndex(
      (doc) => doc.id === editForm.value.id,
    );
    if (docIndex !== -1) {
      documents.value[docIndex] = updatedDoc;
    }

    // 如果当前选中的是被编辑的文档，也要更新选中文档的信息
    if (selectedDocument.value?.id === editForm.value.id) {
      selectedDocument.value = updatedDoc;
    }

    showEditDialog.value = false;
    ElMessage.success(t("openapi.updateSuccess"));
  } catch (error) {
    console.error("更新文档失败:", error);
    ElMessage.error(
      t("openapi.saveFailed", {
        error:
          error instanceof Error ? error.message : t("common.unknownError"),
      }),
    );
  } finally {
    editing.value = false;
  }
};

const refreshDocuments = async () => {
  if (!isAuthenticated.value) {
    ElMessage.error(t("openapi.authRequired"));
    return;
  }

  try {
    await loadDocuments();
    ElMessage.success(t("openapi.refreshSuccess"));
  } catch (error) {
    console.error("刷新文档失败:", error);
    ElMessage.error(
      t("openapi.refreshFailed", {
        error:
          error instanceof Error ? error.message : t("common.unknownError"),
      }),
    );
  }
};

const getStatusText = (status: string) => {
  const statusMap: Record<string, string> = {
    valid: t("openapi.status.valid"),
    invalid: t("openapi.status.invalid"),
    pending: t("openapi.status.pending"),
  };
  return statusMap[status] || t("openapi.status.unknown");
};

const handleSpecAction = async (command: {
  action: string;
  spec: OpenAPISpec;
}) => {
  const { action, spec } = command;

  switch (action) {
    case "edit":
      // 选择文档进行编辑
      const doc = documents.value.find((d) => d.id === spec.id);
      if (doc) {
        selectDocument(doc);
        activeTab.value = "editor";
      }
      break;

    case "duplicate":
      try {
        await openApiStore.duplicateSpec(spec.id);
        ElMessage.success(t("openapi.duplicateSuccess"));
      } catch (error) {
        ElMessage.error(t("openapi.duplicateFailed", { error }));
      }
      break;

    case "download":
      downloadSpec(spec);
      break;

    case "delete":
      try {
        const confirmed = await ElMessageBox.confirm(
          t("openapi.confirmDeleteSpec", { name: spec.name }),
          t("openapi.confirmDelete"),
          {
            confirmButtonText: t("common.confirm"),
            cancelButtonText: t("common.cancel"),
            type: "warning",
            center: true,
          },
        )
          .then(() => true)
          .catch(() => false);
        if (!confirmed) break;

        await measureFunction("deleteSpec", async () => {
          await openApiStore.deleteSpec(spec.id);
        });

        // 如果删除的是当前选中的文档，清空选择
        if (selectedDocument.value?.id === spec.id) {
          selectedDocument.value = null;
          editorContent.value = "";
        }
        // 从文档列表中移除
        documents.value = documents.value.filter((doc) => doc.id !== spec.id);
        ElMessage.success(t("openapi.deleteSpecSuccess"));
      } catch (error) {
        ElMessage.error(t("openapi.deleteFailed", { error }));
      }
      break;
  }
};

const downloadSpec = (spec?: OpenAPISpec) => {
  const content = spec?.content || editorContent.value;
  if (!content) {
    ElMessage.warning(t("openapi.enterContentFirst"));
    return;
  }

  const blob = new Blob([content], {
    type: "application/yaml",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = spec
    ? `${spec.name}-${spec.version}.yaml`
    : `openapi-spec-${new Date().getTime()}.yaml`;
  link.click();
  URL.revokeObjectURL(url);
  ElMessage.success(t("openapi.downloadSuccess"));
};

const handleContentChange = (content: string) => {
  editorContent.value = content;
  if (selectedDocument.value) {
    selectedDocument.value.content = content;
  }
  validationResults.value = null;
};

// 保存文档内容
const saveDocumentContent = async () => {
  if (!selectedDocument.value || !isAuthenticated.value) {
    if (!isAuthenticated.value) {
      ElMessage.error(t("openapi.authRequired"));
    }
    return;
  }

  try {
    saving.value = true;

    // 准备更新数据
    const updateData: UpdateDocumentDto = {
      content: editorContent.value,
    };

    // 调用API更新文档
    const updatedDoc = await documentsApi.updateDocument(
      selectedDocument.value.id,
      updateData,
    );

    // 更新本地文档列表
    const docIndex = documents.value.findIndex(
      (doc) => doc.id === selectedDocument.value!.id,
    );
    if (docIndex !== -1) {
      documents.value[docIndex] = updatedDoc;
    }

    // 更新选中的文档
    selectedDocument.value = updatedDoc;

    ElMessage.success(t("openapi.saveSuccess"));
  } catch (error: any) {
    console.error("保存文档内容失败:", error);

    // 处理400错误，显示更具体的错误信息
    if (error.response && error.response.status === 400) {
      const errorData = error.response.data;
      let errorMessage = "";

      if (errorData && errorData.message) {
        // 检查是否是OpenAPI规范验证错误
        if (
          errorData.message.includes("OpenAPI") ||
          errorData.message.includes("Swagger")
        ) {
          errorMessage = `OpenAPI规范验证失败: ${errorData.message}`;
        } else if (errorData.message.includes("JSON")) {
          errorMessage = `JSON格式错误: ${errorData.message}`;
        } else {
          errorMessage = `请求参数错误: ${errorData.message}`;
        }
      } else {
        errorMessage = "文档内容格式不正确，请检查OpenAPI规范格式";
      }

      ElMessage.error(errorMessage);
    } else {
      // 其他错误使用原有逻辑
      ElMessage.error(
        t("openapi.saveFailed", {
          error:
            error instanceof Error ? error.message : t("common.unknownError"),
        }),
      );
    }
  } finally {
    saving.value = false;
  }
};

const validateSpec = async () => {
  if (!editorContent.value.trim()) {
    ElMessage.warning(t("openapi.enterContentFirst"));
    return;
  }

  validating.value = true;
  try {
    const result = await measureFunction("validateSpec", async () => {
      return await openApiStore.validateSpec(editorContent.value);
    });

    // 更新验证结果
    validationResults.value = result;

    // 更新文档状态
    if (selectedDocument.value) {
      const newStatus = result.valid ? "valid" : "invalid";
      selectedDocument.value.status = newStatus;

      // 调用后端API更新文档状态
      try {
        await documentsApi.updateDocument(selectedDocument.value.id, {
          status: newStatus as any,
        });
      } catch (statusUpdateError) {
        console.error("更新文档状态失败:", statusUpdateError);
        // 状态更新失败不影响验证流程，只记录错误
      }
    }

    // 如果验证成功，解析API路径并更新parsedApis
    if (result.valid) {
      try {
        // 使用 extractApiPaths 函数从内容中提取API路径
        const apiPaths = extractApiPaths(editorContent.value);
        parsedApis.value = apiPaths.map((api, index) => ({
          id: index,
          method: api.method.toUpperCase(),
          path: api.path,
          summary: api.summary || "",
          description: api.description || "",
        }));

        // 自动切换到APIs标签页显示API列表
        activeTab.value = "apis";
      } catch (parseError) {
        console.error("解析API路径失败:", parseError);
        parsedApis.value = [];
      }
    } else {
      // 验证失败时清空API列表
      parsedApis.value = [];
    }

    // 显示验证结果消息
    if (result.valid) {
      const warningCount = result.warnings?.length || 0;
      const apiCount = parsedApis.value.length;
      if (warningCount > 0) {
        ElMessage.success(
          t("openapi.validationSuccessWithWarnings", {
            apiCount,
            warningCount,
          }),
        );
      } else {
        ElMessage.success(t("openapi.validationSuccessDetail", { apiCount }));
      }
    } else {
      const errorCount = result.errors?.length || 0;
      const warningCount = result.warnings?.length || 0;
      if (warningCount > 0) {
        ElMessage.error(
          t("openapi.validationFailedWithWarnings", {
            errorCount,
            warningCount,
          }),
        );
      } else {
        ElMessage.error(t("openapi.validationFailedDetail", { errorCount }));
      }

      // 如果有验证错误，切换到编辑器标签页显示错误信息
      activeTab.value = "editor";
    }
  } catch (error) {
    console.error("验证失败:", error);
    ElMessage.error(
      t("openapi.validationError", {
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    validationResults.value = null;
    parsedApis.value = [];
    if (selectedDocument.value) {
      selectedDocument.value.status = "invalid";

      // 调用后端API更新文档状态为invalid
      try {
        await documentsApi.updateDocument(selectedDocument.value.id, {
          status: "invalid" as any,
        });
      } catch (statusUpdateError) {
        console.error("更新文档状态失败:", statusUpdateError);
        // 状态更新失败不影响验证流程，只记录错误
      }
    }
  } finally {
    validating.value = false;
  }
};

const createNewSpec = async () => {
  if (!createFormRef.value || !isAuthenticated.value) {
    if (!isAuthenticated.value) {
      ElMessage.error(t("openapi.authRequired"));
    }
    return;
  }

  try {
    await createFormRef.value.validate();
    creating.value = true;

    // 准备创建数据
    const createData: CreateDocumentDto = {
      name: createForm.value.name,
      description: createForm.value.description,
      content: generateTemplateContent(createForm.value.template),
    };

    // 调用API创建文档
    const newDoc = await documentsApi.createDocument(createData);

    // 添加到本地文档列表
    documents.value.push(newDoc);
    selectDocument(newDoc);
    showCreateDialog.value = false;

    // 重置表单
    createForm.value = {
      name: "",
      version: "1.0.0",
      description: "",
      template: "",
    };

    ElMessage.success(t("openapi.createSuccess"));
  } catch (error) {
    console.error("创建文档失败:", error);
    ElMessage.error(
      t("openapi.createFailed", {
        error:
          error instanceof Error ? error.message : t("common.unknownError"),
      }),
    );
  } finally {
    creating.value = false;
  }
};

const generateTemplateContent = (template: string) => {
  const templates: Record<string, string> = {
    blank: `openapi: 3.0.0
info:
  title: ${createForm.value.name}
  version: ${createForm.value.version}
  description: ${createForm.value.description}
paths: {}
`,
    "basic-rest": `openapi: 3.0.0
info:
  title: ${createForm.value.name}
  version: ${createForm.value.version}
  description: ${createForm.value.description}
paths:
  /users:
    get:
      summary: ${t("openapi.templates.getUserList")}
      responses:
        '200':
          description: ${t("openapi.templates.success")}
`,
    ecommerce: `openapi: 3.0.0
info:
  title: ${createForm.value.name}
  version: ${createForm.value.version}
  description: ${createForm.value.description}
paths:
  /products:
    get:
      summary: ${t("openapi.templates.getProductList")}
      responses:
        '200':
          description: ${t("openapi.templates.success")}
`,
    "user-management": `openapi: 3.0.0
info:
  title: ${createForm.value.name}
  version: ${createForm.value.version}
  description: ${createForm.value.description}
paths:
  /auth/login:
    post:
      summary: ${t("openapi.templates.userLogin")}
      responses:
        '200':
          description: ${t("openapi.templates.loginSuccess")}
`,
  };
  return templates[template] || templates["blank"];
};

const handleFileChange = (file: UploadFile, fileList: UploadFile[]) => {
  uploadFile.value = file.raw || null;
  uploadFileList.value = fileList;
  if (uploadFile.value) {
    console.log("uploadFile.value", uploadFile.value);

    uploadForm.value.name = uploadFile.value.name.replace(/\.[^/.]+$/, "");
  }
};

const handleFileRemove = (file: UploadFile, fileList: UploadFile[]) => {
  uploadFile.value = null;
  uploadFileList.value = fileList;
  uploadForm.value = { name: "", description: "" };
};

const handleUploadDialogClose = () => {
  showUploadDialog.value = false;
  uploadFile.value = null;
  uploadForm.value = { name: "", description: "" };
  uploadFileList.value = [];
  // 清空上传组件的文件列表
  if (uploadRef.value) {
    uploadRef.value.clearFiles();
  }
};

const confirmUpload = async () => {
  if (!uploadFile.value || !isAuthenticated.value) {
    if (!isAuthenticated.value) {
      ElMessage.error(t("openapi.authRequired"));
    }
    return;
  }

  uploading.value = true;
  try {
    // 读取文件内容
    const rawContent = await readFileContent(uploadFile.value);

    // 准备创建数据
    const createData: CreateDocumentDto = {
      name: uploadForm.value.name,
      description: uploadForm.value.description,
      content: rawContent,
    };

    // 调用API创建文档
    const newDoc = await documentsApi.createDocument(createData);

    // 添加到本地文档列表
    documents.value.push(newDoc);
    selectDocument(newDoc);

    // 确保对话框关闭
    handleUploadDialogClose();

    ElMessage.success(t("openapi.uploadSuccessValidate"));
  } catch (error) {
    console.error("上传文档失败:", error);
    ElMessage.error(
      t("openapi.uploadFailed", {
        error: error instanceof Error ? error.message : String(error),
      }),
    );
  } finally {
    uploading.value = false;
  }
};

// 工具函数
// measureFunction 已在 usePerformanceMonitor() 中定义
// globalConfirmDelete 已在 useConfirmation() 中定义

const readFileContent = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      resolve(e.target?.result as string);
    };
    reader.onerror = () => {
      reject(new Error(t("openapi.fileReadFailed")));
    };
    reader.readAsText(file);
  });
};

// MCP相关方法
const convertToMCP = async () => {
  if (!editorContent.value) {
    ElMessage.warning(t("openapi.selectDocumentFirst"));
    return;
  }

  converting.value = true;
  try {
    // 首先验证当前规范
    const validation = await openApiStore.validateSpec(editorContent.value);
    if (!validation.valid) {
      ElMessage.error(t("openapi.fixErrorsFirst"));
      return;
    }

    // 解析内容并获取工具
    const parseResult = await openApiStore.parseOpenAPIContent(
      editorContent.value,
    );
    mcpTools.value = parseResult.tools || [];
    mcpServerUrl.value = parseResult.servers[0]?.url || "";
    activeTab.value = "tools";

    ElMessage.success(
      t("openapi.convertSuccess", { count: mcpTools.value.length }),
    );
  } catch (error) {
    ElMessage.error(
      t("openapi.convertFailed", {
        error: error instanceof Error ? error.message : error,
      }),
    );
  } finally {
    converting.value = false;
  }
};

const importFromUrl = async () => {
  if (!urlFormRef.value || !isAuthenticated.value) {
    if (!isAuthenticated.value) {
      ElMessage.error(t("openapi.authRequired"));
    }
    return;
  }

  try {
    await urlFormRef.value.validate();
    importing.value = true;

    // 获取URL内容
    const rawContentResponse = await fetch(urlForm.value.url);
    if (!rawContentResponse.ok) {
      throw new Error(
        `HTTP ${rawContentResponse.status}: ${rawContentResponse.statusText}`,
      );
    }
    let rawContent = await rawContentResponse.text();

    // 尝试格式化JSON内容
    try {
      const jsonContent = JSON.parse(rawContent);
      rawContent = JSON.stringify(jsonContent, null, 2);
    } catch (e) {
      // 如果不是JSON格式，保持原样（可能是YAML）
      console.log("Content is not JSON, keeping original format");
    }

    // 准备创建数据
    const createData: CreateDocumentDto = {
      name: urlForm.value.name || "imported_spec",
      description: t("openapi.importedFromUrl"),
      content: rawContent,
    };

    // 调用API创建文档
    const newDoc = await documentsApi.createDocument(createData);

    // 添加到本地文档列表
    documents.value.push(newDoc);
    selectDocument(newDoc);

    // 重置表单
    urlForm.value = {
      url: "",
      name: "",
      authType: "none",
      token: "",
      username: "",
      password: "",
    };

    // 重置表单验证状态
    if (urlFormRef.value) {
      urlFormRef.value.resetFields();
      urlFormRef.value.clearValidate();
    }

    // 关闭对话框
    showUrlDialog.value = false;

    ElMessage.success(t("openapi.importSuccessValidate"));
  } catch (error) {
    console.error("从URL导入文档失败:", error);
    ElMessage.error(
      t("openapi.importFailed", {
        error: error instanceof Error ? error.message : String(error),
      }),
    );
  } finally {
    importing.value = false;
  }
};

const handleTestTool = async (tool: MCPTool, params: Record<string, any>) => {
  try {
    ElMessage.info(t("openapi.testingTool", { name: tool.name }));
    // 这里可以集成实际的工具测试逻辑
    console.log("Testing tool:", tool, "with params:", params);
  } catch (error) {
    ElMessage.error(
      t("openapi.testToolFailed", {
        error: error instanceof Error ? error.message : error,
      }),
    );
  }
};

// 接口相关方法
const getMethodTagType = (method: string) => {
  const methodMap: Record<string, string> = {
    get: "success",
    post: "primary",
    put: "warning",
    delete: "danger",
    patch: "info",
    head: "",
    options: "",
  };
  return methodMap[method.toLowerCase()] || "";
};

const viewApiDetail = (api: any) => {
  ElMessageBox.alert(
    `<div>
      <p><strong>${t("openapi.path")}:</strong> ${api.path}</p>
      <p><strong>${t("openapi.method")}:</strong> ${api.method.toUpperCase()}</p>
      <p><strong>${t("openapi.summary")}:</strong> ${api.summary || t("openapi.none")}</p>
      <p><strong>${t("openapi.description")}:</strong> ${api.description || t("openapi.none")}</p>
      <p><strong>${t("openapi.operationId")}:</strong> ${api.operationId || t("openapi.none")}</p>
      <p><strong>${t("openapi.tags")}:</strong> ${api.tags?.join(", ") || t("openapi.none")}</p>
    </div>`,
    t("openapi.apiDetail"),
    {
      dangerouslyUseHTMLString: true,
      confirmButtonText: t("common.confirm"),
    },
  );
};

// API卡片展开/收起处理
const toggleApiDetail = (index: number) => {
  const expandedIndex = expandedApis.value.indexOf(index);
  if (expandedIndex > -1) {
    expandedApis.value.splice(expandedIndex, 1);
  } else {
    expandedApis.value.push(index);
  }
};

// 响应状态码样式类
const getResponseCodeClass = (code: string) => {
  const codeNum = parseInt(code);
  if (codeNum >= 200 && codeNum < 300) {
    return "response-success";
  } else if (codeNum >= 300 && codeNum < 400) {
    return "response-redirect";
  } else if (codeNum >= 400 && codeNum < 500) {
    return "response-client-error";
  } else if (codeNum >= 500) {
    return "response-server-error";
  }
  return "response-default";
};

// 窗口大小变化处理
const handleResize = () => {
  // 触发计算属性重新计算
  if (editorContainerRef.value) {
    nextTick(() => {
      // 强制重新计算高度
      editorHeight.value;
    });
  }
};

// 生命周期
onMounted(async () => {
  // 检查用户认证状态并加载文档
  await checkAuthentication();

  // 添加窗口大小变化监听器
  window.addEventListener("resize", handleResize);
});

onUnmounted(() => {
  // 清理窗口大小变化监听器
  window.removeEventListener("resize", handleResize);
});
</script>

<style scoped>
.openapi-manager {
  height: 100vh;
  background: linear-gradient(
    180deg,
    var(--bg-secondary) 0%,
    var(--bg-tertiary) 100%
  );
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 顶部工具栏样式 */
/* 页面头部样式 */
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

/* 主要内容区域 */
.manager-content {
  flex: 1;
  padding: 24px 32px;
  overflow: hidden;
}

/* 左侧文档列表样式 */
.document-list-card {
  border: 1px solid var(--border-color);
  border-radius: var(--radius-large);
  box-shadow: var(--shadow-light);
  backdrop-filter: blur(20px) saturate(180%);
  background: var(--bg-primary);
  overflow: hidden;
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
  color: var(--text-primary);
  background: var(--bg-secondary);
  padding: var(--spacing-lg) var(--spacing-lg);
  border-bottom: 1px solid var(--border-color);
}

.list-header span {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
}

.search-container {
  margin: 16px;
  margin-bottom: 16px;
}

.search-container .el-input {
  border-radius: var(--radius-medium);
}

.document-list {
  height: calc(100vh - 200px);
  overflow-y: auto;
  padding: 0 16px 16px;
}

.document-items {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.document-item {
  padding: var(--spacing-lg);
  border: 2px solid transparent;
  border-radius: var(--radius-medium);
  background: var(--bg-primary);
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  position: relative;
  overflow: hidden;
  min-height: 120px;
}

.document-item::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(
    135deg,
    rgba(0, 122, 255, 0.1) 0%,
    rgba(0, 81, 208, 0.1) 100%
  );
  opacity: 0;
  transition: opacity 0.3s ease;
}

.document-item:hover {
  border-color: var(--apple-blue);
  transform: translateY(-2px);
  box-shadow: var(--shadow-medium);
}

.document-item:hover::before {
  opacity: 1;
}

.document-item.active {
  border-color: var(--apple-blue);
  background: var(--bg-quaternary);
  box-shadow: var(--shadow-light);
  transform: translateY(-1px);
}

.document-item.active::before {
  opacity: 1;
}

.document-info {
  flex: 1;
  position: relative;
  z-index: 1;
}

.document-name {
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: var(--spacing-sm);
  font-size: 15px;
  line-height: 1.4;
}

.document-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.document-meta {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.upload-time {
  font-size: 12px;
  color: var(--text-secondary);
  background: var(--bg-quaternary);
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-small);
  white-space: nowrap;
}

.document-actions {
  position: relative;
  z-index: 1;
  opacity: 1;
  width: 80px;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.action-buttons {
  margin-top: 15px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: center;
  justify-content: center;
}

.action-buttons .el-button {
  width: 32px;
  height: 28px;
  padding: 0;
  margin: 0px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 右侧详情区域样式 */
.detail-card {
  border: 1px solid var(--border-color);
  border-radius: var(--radius-large);
  box-shadow: var(--shadow-light);
  backdrop-filter: blur(20px) saturate(180%);
  background: var(--bg-primary);
  overflow: hidden;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
  color: var(--text-primary);
  background: var(--bg-secondary);
  padding: var(--spacing-lg) var(--spacing-lg);
  border-bottom: 1px solid var(--border-color);
}

.detail-header span {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
}

.empty-header {
  color: var(--text-secondary);
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.detail-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.detail-controls .el-button {
  border-radius: var(--radius-small);
  font-weight: 500;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.detail-controls .el-button:hover {
  transform: translateY(-1px);
}

.detail-content {
  height: calc(100vh - 200px);
  overflow: hidden;
}

.empty-state {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-secondary);
  border-radius: var(--radius-medium);
  margin: var(--spacing-lg);
}

.error-state {
  background: var(--bg-error);
  border: 1px solid var(--border-error);
  border-radius: var(--radius-medium);
  margin: var(--spacing-lg);
}

.loading-state {
  background: var(--bg-quaternary);
  border-radius: var(--radius-medium);
  margin: var(--spacing-lg);
}

.content-tabs {
  height: 100%;
}

.editor-container {
  height: 100%;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-medium);
  overflow: hidden;
  box-shadow: var(--shadow-light);
}

.apis-container,
.tools-container {
  height: 100%;
  padding: var(--spacing-lg);
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-medium);
  overflow-y: auto;
  box-shadow: var(--shadow-light);
}

/* 上传对话框样式 */
.upload-container {
  padding: 20px 0;
}

.upload-demo {
  margin-bottom: 20px;
}

.upload-demo .el-upload-dragger {
  border: 2px dashed var(--border-color);
  border-radius: var(--radius-large);
  background: var(--bg-secondary);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

.upload-demo .el-upload-dragger::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(
    135deg,
    rgba(0, 122, 255, 0.1) 0%,
    rgba(0, 81, 208, 0.1) 100%
  );
  opacity: 0;
  transition: opacity 0.3s ease;
}

.upload-demo .el-upload-dragger:hover {
  border-color: var(--apple-blue);
  background: var(--bg-quaternary);
  transform: translateY(-2px);
  box-shadow: var(--shadow-medium);
}

.upload-demo .el-upload-dragger:hover::before {
  opacity: 1;
}

.upload-form {
  margin-top: var(--spacing-lg);
  padding-top: var(--spacing-lg);
  border-top: 1px solid var(--border-color);
}

/* 对话框样式 */
.el-dialog {
  border-radius: var(--radius-xl);
  overflow: hidden;
  box-shadow: var(--shadow-heavy);
  backdrop-filter: blur(20px) saturate(180%);
}

.el-dialog__header {
  background: linear-gradient(
    135deg,
    var(--apple-blue) 0%,
    var(--apple-blue-dark) 100%
  );
  color: white;
  padding: var(--spacing-lg) var(--spacing-xl);
}

.el-dialog__title {
  color: white;
  font-weight: 600;
  font-size: 18px;
}

.el-dialog__body {
  padding: var(--spacing-xl);
  background: var(--bg-primary);
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-md);
  padding: 0 var(--spacing-xl) var(--spacing-xl);
  background: var(--bg-primary);
}

/* 表单样式增强 */
.el-form-item {
  margin-bottom: var(--spacing-lg);
}

.el-input__wrapper {
  border-radius: var(--radius-medium);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: var(--shadow-light);
}

.el-input__wrapper:hover {
  box-shadow: var(--shadow-medium);
  transform: translateY(-1px);
}

.el-input__wrapper.is-focus {
  box-shadow: 0 4px 16px rgba(64, 158, 255, 0.2);
}

.el-select {
  width: 100%;
}

.el-select .el-input__wrapper {
  border-radius: 12px;
}

.el-textarea__inner {
  border-radius: 12px;
  transition: all 0.3s ease;
}

.form-tip {
  font-size: 12px;
  color: #909399;
  margin-top: 6px;
  line-height: 1.4;
  background: rgba(144, 147, 153, 0.1);
  padding: 6px 10px;
  border-radius: 6px;
}

/* 按钮样式增强 */
.el-button {
  border-radius: 10px;
  font-weight: 500;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

.el-button::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.2) 0%,
    rgba(255, 255, 255, 0.1) 100%
  );
  opacity: 0;
  transition: opacity 0.3s ease;
}

.el-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
}

.el-button:hover::before {
  opacity: 1;
}

.el-button--primary {
  background: linear-gradient(135deg, #409eff 0%, #36a3f7 100%);
  border: none;
}

.el-button--primary:hover {
  background: linear-gradient(135deg, #36a3f7 0%, #2b85e4 100%);
}

.el-button.active {
  background: linear-gradient(135deg, #409eff 0%, #36a3f7 100%);
  color: white;
  border: none;
  box-shadow: 0 4px 16px rgba(64, 158, 255, 0.3);
}

/* 标签样式 */
.el-tag {
  border-radius: 8px;
  font-weight: 500;
  backdrop-filter: blur(10px);
  border: none;
}

.el-tag--success {
  background: linear-gradient(
    135deg,
    rgba(103, 194, 58, 0.2) 0%,
    rgba(139, 195, 74, 0.2) 100%
  );
  color: #67c23a;
}

.el-tag--danger {
  background: linear-gradient(
    135deg,
    rgba(245, 108, 108, 0.2) 0%,
    rgba(244, 67, 54, 0.2) 100%
  );
  color: #f56c6c;
}

.el-tag--warning {
  background: linear-gradient(
    135deg,
    rgba(230, 162, 60, 0.2) 0%,
    rgba(255, 193, 7, 0.2) 100%
  );
  color: #e6a23c;
}

/* API表格样式 */
.el-table {
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.05);
}

.el-table th {
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  font-weight: 600;
}

/* 响应式设计 */
@media (max-width: 1200px) {
  .manager-header {
    padding: 16px 24px;
  }

  .manager-content {
    padding: 16px 24px;
  }

  .page-title {
    font-size: 24px;
  }

  .el-col:first-child {
    margin-bottom: 20px;
  }
}

@media (max-width: 768px) {
  .manager-header {
    flex-direction: column;
    gap: 16px;
    align-items: flex-start;
  }

  .header-actions {
    width: 100%;
    justify-content: flex-end;
  }

  .el-col {
    margin-bottom: 16px;
  }
}

/* 滚动条样式 */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: linear-gradient(135deg, #f1f1f1 0%, #e0e0e0 100%);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb {
  background: linear-gradient(135deg, #c1c1c1 0%, #a8a8a8 100%);
  border-radius: 4px;
  transition: all 0.3s ease;
}

::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(135deg, #a8a8a8 0%, #909090 100%);
}

/* 动画效果 */
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes slideInRight {
  from {
    opacity: 0;
    transform: translateX(20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.document-item {
  animation: fadeInUp 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.detail-card {
  animation: slideInRight 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

/* 卡片阴影效果 */
.document-list-card,
.detail-card {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.document-list-card:hover,
.detail-card:hover {
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.15);
  transform: translateY(-2px);
}

/* API列表样式 */
.api-list {
  padding: 24px;
}

.api-summary {
  margin-bottom: 24px;
}

.api-summary .el-alert {
  border-radius: 12px;
  border: none;
  background: linear-gradient(
    135deg,
    rgba(103, 194, 58, 0.1) 0%,
    rgba(139, 195, 74, 0.1) 100%
  );
}

.error-item {
  margin-bottom: 12px;
  padding: 12px 16px;
  background: linear-gradient(135deg, #fef0f0 0%, #fde2e2 100%);
  border-radius: 8px;
  border-left: 4px solid #f56c6c;
  font-size: 14px;
  box-shadow: 0 2px 8px rgba(245, 108, 108, 0.1);
}

.validation-results {
  margin-top: 20px;
}

.validation-results .el-alert {
  border-radius: 12px;
  border: none;
}

/* 文件列表样式 */
.file-list {
  max-height: 200px;
  overflow-y: auto;
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  border-radius: 12px;
  padding: 16px;
  margin-top: 16px;
}

.file-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: white;
  border-radius: 8px;
  margin-bottom: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  transition: all 0.3s ease;
}

.file-item:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

.file-name {
  flex: 1;
  font-weight: 500;
  color: #303133;
}

.file-size {
  color: #909399;
  font-size: 12px;
  background: rgba(144, 147, 153, 0.1);
  padding: 4px 8px;
  border-radius: 6px;
}

/* API卡片样式 - Swagger UI风格 */
.api-list {
  padding: 16px;
  background: var(--bg-secondary);
}

.api-card {
  margin-bottom: 12px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-primary);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transition: all 0.2s ease;
}

.api-card:hover {
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
}

.api-card__header {
  padding: 12px 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid transparent;
  transition: all 0.2s ease;
}

.api-card__header:hover {
  background: var(--bg-hover);
}

.api-card__method-info {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.api-method-tag {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 3px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  min-width: 60px;
  text-align: center;
  color: white;
}

.method-get {
  background: #61affe;
}

.method-post {
  background: #49cc90;
}

.method-put {
  background: #fca130;
}

.method-delete {
  background: #f93e3e;
}

.method-patch {
  background: #50e3c2;
}

.method-head {
  background: #9012fe;
}

.method-options {
  background: #0d5aa7;
}

.api-path {
  font-family: "Monaco", "Menlo", "Ubuntu Mono", monospace;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.api-card__summary {
  display: flex;
  align-items: center;
  gap: 8px;
}

.api-summary {
  color: var(--text-secondary);
  font-size: 14px;
  flex: 1;
  text-align: right;
}

.expand-icon {
  transition: transform 0.2s ease;
  color: var(--text-primary);
}

.expand-icon.expanded {
  transform: rotate(180deg);
}

.api-card__details {
  border-top: 1px solid var(--border-color);
  background: var(--bg-secondary);
}

.api-detail-section {
  padding: 16px;
}

.detail-item {
  margin-bottom: 16px;
}

.detail-item:last-child {
  margin-bottom: 0;
}

.detail-item label {
  display: inline-block;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4px;
  font-size: 14px;
}

.detail-item span {
  color: var(--text-primary);
  font-size: 14px;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.api-tag {
  background: var(--bg-tertiary) !important;
  color: var(--text-primary) !important;
  border: 1px solid var(--border-color) !important;
}

.parameter-list {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  overflow: hidden;
}

.parameter-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-color);
}

.parameter-item:last-child {
  border-bottom: none;
}

.param-name {
  font-weight: 600;
  color: var(--text-primary);
  min-width: 120px;
}

.param-type {
  color: var(--text-primary);
  font-family: "Monaco", "Menlo", "Ubuntu Mono", monospace;
  font-size: 12px;
  background: var(--bg-tertiary);
  padding: 2px 6px;
  border-radius: 3px;
}

.param-required {
  color: #f93e3e;
  font-size: 12px;
  font-weight: 600;
}

.response-list {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  overflow: hidden;
}

.response-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-color);
}

.response-item:last-child {
  border-bottom: none;
}

.response-code {
  font-weight: 600;
  font-family: "Monaco", "Menlo", "Ubuntu Mono", monospace;
  font-size: 12px;
  padding: 2px 6px;
  border-radius: 3px;
  min-width: 50px;
  text-align: center;
  color: white;
}

.response-success {
  background: #49cc90;
}

.response-redirect {
  background: #61affe;
}

.response-client-error {
  background: #fca130;
}

.response-server-error {
  background: #f93e3e;
}

.response-default {
  background: #9012fe;
}

.response-desc {
  color: var(--text-primary);
  font-size: 14px;
  flex: 1;
}

/* API卡片不同方法的边框颜色 */
.api-card--get {
  border-left: 4px solid #61affe;
}

.api-card--post {
  border-left: 4px solid #49cc90;
}

.api-card--put {
  border-left: 4px solid #fca130;
}

.api-card--delete {
  border-left: 4px solid #f93e3e;
}

.api-card--patch {
  border-left: 4px solid #50e3c2;
}

.api-card--head {
  border-left: 4px solid #9012fe;
}

.api-card--options {
  border-left: 4px solid #0d5aa7;
}
</style>
