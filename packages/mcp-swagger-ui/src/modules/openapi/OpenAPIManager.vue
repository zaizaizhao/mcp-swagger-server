<template>
  <div class="openapi-manager">
    <!-- 璁よ瘉妫€鏌ュ姞杞界姸鎬?-->
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

    <!-- 鏈璇佺姸鎬?-->
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

    <!-- 宸茶璇佺姸鎬?- 姝ｅ父椤甸潰鍐呭 -->
    <template v-else>
      <!-- 椤甸潰澶撮儴 -->
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
          <el-button type="warning" @click="goToEndpointRegistry" :icon="Plus">
            Endpoint Registry
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

      <!-- 涓昏鍐呭鍖哄煙 -->
      <div class="manager-content">
        <el-row :gutter="24" style="height: calc(100vh - 80px)">
          <!-- 宸︿晶锛氭枃妗ｅ垪琛?-->
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

              <!-- 鎼滅储妗?-->
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

              <!-- 鏂囨。鍒楄〃 -->
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

          <!-- 鍙充晶锛氭枃妗ｈ鎯?-->
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
                <!-- 绌虹姸鎬?-->
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

                <!-- 閿欒鐘舵€?-->
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

                <!-- 鍔犺浇鐘舵€?-->
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

                <!-- 姝ｅ父鐘舵€佹垨缂栬緫鐘舵€?-->
                <div v-else class="content-tabs" style="height: 100%">
                  <div
                    v-show="activeTab === 'editor'"
                    ref="editorContainerRef"
                    class="editor-container"
                    style="height: 100%; position: relative"
                  >
                    <!-- 楠岃瘉閿欒鎻愮ず -->
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
                      <!-- API鍗＄墖鍒楄〃 -->
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

                        <!-- 鍙睍寮€鐨勮缁嗕俊鎭?-->
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
                                <label>{{ t("openapi.description") }}:</label>
                                <span>{{ api.description }}</span>
                              </div>

                              <div v-if="api.operationId" class="detail-item">
                                <label>{{ t("openapi.operationId") }}:</label>
                                <span>{{ api.operationId }}</span>
                              </div>

                              <div
                                v-if="api.tags && api.tags.length"
                                class="detail-item"
                              >
                                <label>{{ t("openapi.tags") }}:</label>
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
                                <label>{{ t("openapi.parameters") }}:</label>
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
                                <label>{{ t("openapi.responses") }}:</label>
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

      <!-- 鍒涘缓瑙勮寖瀵硅瘽妗?-->
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

      <!-- 涓婁紶瀵硅瘽妗?-->
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

      <!-- URL瀵煎叆瀵硅瘽妗?-->
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
import { useRouter } from "vue-router";
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
import { openApiAPI, serverAPI } from "../../services/api";

// 瀵煎叆鍏ㄥ眬鍔熻兘
import { useConfirmation } from "../../composables/useConfirmation";
import { useFormValidation } from "../../composables/useFormValidation";
import { usePerformanceMonitor } from "../../composables/usePerformance";

// 鍥介檯鍖?
const { t } = useI18n();
const router = useRouter();
// import LoadingOverlay from '@/shared/components/ui/LoadingOverlay.vue' // 鏆傛椂娉ㄩ噴鎺夛紝濡傛灉闇€瑕佸彲浠ュ垱寤鸿繖涓粍浠?

// 鐘舵€佺鐞?
const openApiStore = useOpenAPIStore();

// 鍏ㄥ眬鍔熻兘
const {
  confirmDelete: globalConfirmDelete,
  confirmDangerousAction,
  confirmSave,
} = useConfirmation();

const { startMonitoring, stopMonitoring, measureFunction } =
  usePerformanceMonitor();

// 鍝嶅簲寮忔暟鎹?
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
const mcpTools = ref<any[]>([]); // MCP宸ュ叿鍒楄〃
const mcpServerUrl = ref("");
const documents = ref<Document[]>([]); // 鏂囨。鍒楄〃
const parsedApis = ref<any[]>([]); // 瑙ｆ瀽鐨凙PI鍒楄〃
const uploadFile = ref<File | null>(null);
const editorContainerRef = ref<HTMLElement>(); // 缂栬緫鍣ㄥ鍣ㄥ紩鐢?
const expandedApis = ref<number[]>([]); // 灞曞紑鐨凙PI鍗＄墖绱㈠紩鍒楄〃
const isAuthenticated = ref(false); // 鐢ㄦ埛璁よ瘉鐘舵€?
const authChecking = ref(true); // 璁よ瘉妫€鏌ョ姸鎬?

// 瀵硅瘽妗嗙姸鎬?
const showCreateDialog = ref(false);
const showUploadDialog = ref(false);
const showUrlDialog = ref(false);
const showEditDialog = ref(false);
const creating = ref(false);
const uploading = ref(false);
const importing = ref(false);
const editing = ref(false);

// 琛ㄥ崟寮曠敤
const createFormRef = ref<FormInstance>();
const urlFormRef = ref<FormInstance>();
const uploadRef = ref();
const editFormRef = ref<FormInstance>();

// 涓婁紶鏂囦欢鍒楄〃
const uploadFileList = ref<UploadFile[]>([]);

// 琛ㄥ崟鏁版嵁
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

// 琛ㄥ崟楠岃瘉瑙勫垯
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

// Monaco缂栬緫鍣ㄩ€夐」
const editorOptions: any = {
  theme: "vs-dark",
  fontSize: 14,
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  automaticLayout: true,
  tabSize: 2,
  wordWrap: "on" as const,
  // 鏀寔澶у瀷鏂囦欢
  largeFileOptimizations: false,
  // 澶у箙澧炲姞鍐呭闀垮害闄愬埗 - 鎻愬崌鍒版洿澶х殑鍊?
  maxTokenizationLineLength: 500000,
  // 鎻愰珮娓叉煋鎬ц兘
  renderValidationDecorations: "on",
  // 鏀寔鏇村琛屾暟娓叉煋 - 澶у箙鎻愬崌琛屾暟闄愬埗
  stopRenderingLineAfter: 200000,
  // 绂佺敤璇硶妫€鏌ヤ互鎻愰珮鎬ц兘
  validate: false,
  // 澧炲姞婊氬姩鎬ц兘
  smoothScrolling: true,
  // 绂佺敤涓嶅繀瑕佺殑鍔熻兘浠ユ彁楂樻€ц兘
  folding: false,
  lineNumbers: "on",
  // 澧炲姞鏇村澶ф枃浠舵敮鎸侀厤缃?
  scrollbar: {
    vertical: "auto",
    horizontal: "auto",
    handleMouseWheel: true,
  },
  // 绂佺敤浠ｇ爜鎶樺彔浠ユ彁楂樻€ц兘
  glyphMargin: false,
  // 浼樺寲澶ф枃浠舵覆鏌?
  renderLineHighlight: "none",
};

// 璁＄畻灞炴€?
const filteredDocuments = computed(() => {
  if (!searchQuery.value) return documents.value;

  const query = searchQuery.value.toLowerCase();
  return documents.value.filter(
    (doc) =>
      doc.name.toLowerCase().includes(query) ||
      doc.description?.toLowerCase().includes(query),
  );
});

const goToEndpointRegistry = () => {
  router.push({
    path: "/endpoint-registry",
    query: {
      sourceType: "imported",
    },
  });
};

// 璁＄畻缂栬緫鍣ㄩ珮搴?
const editorHeight = computed(() => {
  // 濡傛灉瀹瑰櫒寮曠敤瀛樺湪锛屽姩鎬佽绠楀彲鐢ㄩ珮搴?
  if (editorContainerRef.value) {
    const containerHeight = editorContainerRef.value.clientHeight;
    // 鍑忓幓涓€浜涜竟璺濆拰鍏朵粬鍏冪礌鐨勯珮搴?
    return Math.max(containerHeight - 20, 300); // 鏈€灏忛珮搴?00px
  }
  // 榛樿浣跨敤瑙嗙獥楂樺害鐨勮绠楀€?
  return Math.max(window.innerHeight - 300, 400);
});

// 鏂规硶
// 妫€鏌ョ敤鎴疯璇佺姸鎬?
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

// 鍔犺浇鏂囨。鍒楄〃
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

  // 璁剧疆鍔犺浇鐘舵€?
  loading.value = true;
  selectedDocument.value = doc;
  editorContent.value = "";
  validationResults.value = null;
  activeTab.value = "editor";

  // 娓呯┖涔嬪墠鐨勮В鏋愭暟鎹?
  parsedApis.value = [];
  mcpTools.value = [];
  mcpServerUrl.value = "";

  try {
    // 璋冪敤API鑾峰彇瀹屾暣鐨勬枃妗ｅ唴瀹?
    const fullDocument = await documentsApi.getDocument(doc.id);

    // 鏇存柊閫変腑鐨勬枃妗ｅ拰缂栬緫鍣ㄥ唴瀹?
    const sanitizedContent = sanitizeOpenApiContent(fullDocument.content || "");

    selectedDocument.value = fullDocument;
    selectedDocument.value.content = sanitizedContent;
    editorContent.value = sanitizedContent;

    // 鑷姩瑙ｆ瀽OpenAPI鍐呭骞跺～鍏呮暟鎹?
    if (sanitizedContent && sanitizedContent.trim()) {
      try {
        // 瑙ｆ瀽API璺緞鍜岃缁嗕俊鎭?
        const { data: parsedData } = parseOpenAPI(sanitizedContent);
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

        // 瑙ｆ瀽MCP宸ュ叿
        try {
          const parseResult =
            await openApiStore.parseOpenAPIContent(sanitizedContent);
          mcpTools.value = parseResult.tools || [];
          mcpServerUrl.value = parseResult.servers[0]?.url || "";
        } catch (mcpError) {
          console.warn("瑙ｆ瀽MCP宸ュ叿澶辫触:", mcpError);
          mcpTools.value = [];
          mcpServerUrl.value = "";
        }

        // 淇濇寔鍦ㄧ紪杈戞爣绛鹃〉锛屼笉鑷姩鍒囨崲
        // if (parsedApis.value.length > 0) {
        //   activeTab.value = 'apis'
        // }
      } catch (parseError) {
        console.error("瑙ｆ瀽OpenAPI鍐呭澶辫触:", parseError);
        ElMessage.warning(t("openapi.parseContentFailed"));
        parsedApis.value = [];
        mcpTools.value = [];
        mcpServerUrl.value = "";
      }
    }
  } catch (error) {
    console.error("鑾峰彇鏂囨。鍐呭澶辫触:", error);
    ElMessage.error(
      t("openapi.fetchDocumentFailed", {
        error:
          error instanceof Error ? error.message : t("common.unknownError"),
      }),
    );

    // 閲嶇疆鐘舵€?
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
  // 濉厖缂栬緫琛ㄥ崟鏁版嵁
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
    // 鏌ユ壘瑕佸垹闄ょ殑鏂囨。
    const docToDelete = documents.value.find((doc) => doc.id === docId);
    if (!docToDelete) {
      ElMessage.error(t("openapi.documentNotFound"));
      return;
    }

    // 鏄剧ず纭瀵硅瘽妗嗭紝鍖呭惈鏂囨。鍚嶇О
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

    // 璋冪敤API鍒犻櫎鏂囨。
    await documentsApi.deleteDocument(docId);

    // 浠庢湰鍦版枃妗ｅ垪琛ㄤ腑鍒犻櫎
    documents.value = documents.value.filter((doc) => doc.id !== docId);

    // 濡傛灉鍒犻櫎鐨勬槸褰撳墠閫変腑鐨勬枃妗ｏ紝娓呯┖鐩稿叧鐘舵€?
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
    console.error("鍒犻櫎鏂囨。澶辫触:", error);
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

    // 鍑嗗鏇存柊鏁版嵁
    const updateData: UpdateDocumentDto = {
      name: editForm.value.name,
      description: editForm.value.description,
    };

    // 璋冪敤API鏇存柊鏂囨。
    const updatedDoc = await documentsApi.updateDocument(
      editForm.value.id,
      updateData,
    );

    // 鏇存柊鏈湴鏂囨。鍒楄〃
    const docIndex = documents.value.findIndex(
      (doc) => doc.id === editForm.value.id,
    );
    if (docIndex !== -1) {
      documents.value[docIndex] = updatedDoc;
    }

    // 濡傛灉褰撳墠閫変腑鐨勬槸琚紪杈戠殑鏂囨。锛屼篃瑕佹洿鏂伴€変腑鏂囨。鐨勪俊鎭?
    if (selectedDocument.value?.id === editForm.value.id) {
      selectedDocument.value = updatedDoc;
    }

    showEditDialog.value = false;
    ElMessage.success(t("openapi.updateSuccess"));
  } catch (error) {
    console.error("鏇存柊鏂囨。澶辫触:", error);
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
    console.error("鍒锋柊鏂囨。澶辫触:", error);
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
      // 閫夋嫨鏂囨。杩涜缂栬緫
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

        // 濡傛灉鍒犻櫎鐨勬槸褰撳墠閫変腑鐨勬枃妗ｏ紝娓呯┖閫夋嫨
        if (selectedDocument.value?.id === spec.id) {
          selectedDocument.value = null;
          editorContent.value = "";
        }
        // 浠庢枃妗ｅ垪琛ㄤ腑绉婚櫎
        documents.value = documents.value.filter((doc) => doc.id !== spec.id);
        ElMessage.success(t("openapi.deleteSpecSuccess"));
      } catch (error) {
        ElMessage.error(t("openapi.deleteFailed", { error }));
      }
      break;
  }
};

const sanitizeOpenApiContent = (content: string): string => {
  try {
    const parsed = JSON.parse(content);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return content;
    }

    const sanitized = { ...parsed } as Record<string, any>;
    delete sanitized.metadata;
    delete sanitized.tools;
    delete sanitized.endpoints;
    delete sanitized.parsedAt;
    delete sanitized.parseId;

    return JSON.stringify(sanitized, null, 2);
  } catch {
    return content;
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

// 淇濆瓨鏂囨。鍐呭
const saveDocumentContent = async () => {
  if (!selectedDocument.value || !isAuthenticated.value) {
    if (!isAuthenticated.value) {
      ElMessage.error(t("openapi.authRequired"));
    }
    return;
  }

  try {
    saving.value = true;

    // 鍑嗗鏇存柊鏁版嵁
    const sanitizedContent = sanitizeOpenApiContent(editorContent.value);
    if (sanitizedContent !== editorContent.value) {
      editorContent.value = sanitizedContent;
      if (selectedDocument.value) {
        selectedDocument.value.content = sanitizedContent;
      }
    }

    const updateData: UpdateDocumentDto = {
      content: sanitizedContent,
    };

    // 璋冪敤API鏇存柊鏂囨。
    const updatedDoc = await documentsApi.updateDocument(
      selectedDocument.value.id,
      updateData,
    );

    // 鏇存柊鏈湴鏂囨。鍒楄〃
    const docIndex = documents.value.findIndex(
      (doc) => doc.id === selectedDocument.value!.id,
    );
    if (docIndex !== -1) {
      documents.value[docIndex] = updatedDoc;
    }

    // 鏇存柊閫変腑鐨勬枃妗?
    selectedDocument.value = updatedDoc;

    ElMessage.success(t("openapi.saveSuccess"));
  } catch (error: any) {
    console.error("淇濆瓨鏂囨。鍐呭澶辫触:", error);

    // 澶勭悊400閿欒锛屾樉绀烘洿鍏蜂綋鐨勯敊璇俊鎭?
    if (error.response && error.response.status === 400) {
      const errorData = error.response.data;
      let errorMessage = "";

      if (errorData && errorData.message) {
        // 妫€鏌ユ槸鍚︽槸OpenAPI瑙勮寖楠岃瘉閿欒
        if (
          errorData.message.includes("OpenAPI") ||
          errorData.message.includes("Swagger")
        ) {
          errorMessage = `OpenAPI瑙勮寖楠岃瘉澶辫触: ${errorData.message}`;
        } else if (errorData.message.includes("JSON")) {
          errorMessage = `JSON鏍煎紡閿欒: ${errorData.message}`;
        } else {
          errorMessage = `璇锋眰鍙傛暟閿欒: ${errorData.message}`;
        }
      } else {
        errorMessage = "鏂囨。鍐呭鏍煎紡涓嶆纭紝璇锋鏌penAPI瑙勮寖鏍煎紡";
      }

      ElMessage.error(errorMessage);
    } else {
      // 鍏朵粬閿欒浣跨敤鍘熸湁閫昏緫
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
    const sanitizedContent = sanitizeOpenApiContent(editorContent.value);
    if (sanitizedContent !== editorContent.value) {
      editorContent.value = sanitizedContent;
      if (selectedDocument.value) {
        selectedDocument.value.content = sanitizedContent;
      }
    }

    const result = await measureFunction("validateSpec", async () => {
      return await openApiStore.validateOpenAPIContent(sanitizedContent);
    });

    // 鏇存柊楠岃瘉缁撴灉
    validationResults.value = result;

    // 鏇存柊鏂囨。鐘舵€?
    if (selectedDocument.value) {
      const newStatus = result.valid ? "valid" : "invalid";
      selectedDocument.value.status = newStatus;

      // 璋冪敤鍚庣API鏇存柊鏂囨。鐘舵€?
      try {
        await documentsApi.updateDocument(selectedDocument.value.id, {
          status: newStatus as any,
        });
      } catch (statusUpdateError) {
        console.error("鏇存柊鏂囨。鐘舵€佸け璐?", statusUpdateError);
        // 鐘舵€佹洿鏂板け璐ヤ笉褰卞搷楠岃瘉娴佺▼锛屽彧璁板綍閿欒
      }
    }

    // 濡傛灉楠岃瘉鎴愬姛锛岃В鏋怉PI璺緞骞舵洿鏂皃arsedApis
    if (result.valid) {
      try {
        // 浣跨敤 extractApiPaths 鍑芥暟浠庡唴瀹逛腑鎻愬彇API璺緞
        const apiPaths = extractApiPaths(sanitizedContent);
        parsedApis.value = apiPaths.map((api, index) => ({
          id: index,
          method: api.method.toUpperCase(),
          path: api.path,
          summary: api.summary || "",
          description: api.description || "",
        }));

        // 鑷姩鍒囨崲鍒癆PIs鏍囩椤垫樉绀篈PI鍒楄〃
        activeTab.value = "apis";
      } catch (parseError) {
        console.error("瑙ｆ瀽API璺緞澶辫触:", parseError);
        parsedApis.value = [];
      }
    } else {
      // 楠岃瘉澶辫触鏃舵竻绌篈PI鍒楄〃
      parsedApis.value = [];
    }

    // 鏄剧ず楠岃瘉缁撴灉娑堟伅
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

      // 濡傛灉鏈夐獙璇侀敊璇紝鍒囨崲鍒扮紪杈戝櫒鏍囩椤垫樉绀洪敊璇俊鎭?
      activeTab.value = "editor";
    }
  } catch (error) {
    console.error("楠岃瘉澶辫触:", error);
    ElMessage.error(
      t("openapi.validationError", {
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    validationResults.value = null;
    parsedApis.value = [];
    if (selectedDocument.value) {
      selectedDocument.value.status = "invalid";

      // 璋冪敤鍚庣API鏇存柊鏂囨。鐘舵€佷负invalid
      try {
        await documentsApi.updateDocument(selectedDocument.value.id, {
          status: "invalid" as any,
        });
      } catch (statusUpdateError) {
        console.error("鏇存柊鏂囨。鐘舵€佸け璐?", statusUpdateError);
        // 鐘舵€佹洿鏂板け璐ヤ笉褰卞搷楠岃瘉娴佺▼锛屽彧璁板綍閿欒
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

    // 鍑嗗鍒涘缓鏁版嵁
    const createData: CreateDocumentDto = {
      name: createForm.value.name,
      description: createForm.value.description,
      content: generateTemplateContent(createForm.value.template),
    };

    // 璋冪敤API鍒涘缓鏂囨。
    const newDoc = await documentsApi.createDocument(createData);

    // 娣诲姞鍒版湰鍦版枃妗ｅ垪琛?
    documents.value.push(newDoc);
    selectDocument(newDoc);
    showCreateDialog.value = false;

    // 閲嶇疆琛ㄥ崟
    createForm.value = {
      name: "",
      version: "1.0.0",
      description: "",
      template: "",
    };

    ElMessage.success(t("openapi.createSuccess"));
  } catch (error) {
    console.error("鍒涘缓鏂囨。澶辫触:", error);
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
  // 娓呯┖涓婁紶缁勪欢鐨勬枃浠跺垪琛?
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
    // 璇诲彇鏂囦欢鍐呭
    const rawContent = await readFileContent(uploadFile.value);

    // 鍑嗗鍒涘缓鏁版嵁
    const createData: CreateDocumentDto = {
      name: uploadForm.value.name,
      description: uploadForm.value.description,
      content: rawContent,
    };

    // 璋冪敤API鍒涘缓鏂囨。
    const newDoc = await documentsApi.createDocument(createData);

    // 娣诲姞鍒版湰鍦版枃妗ｅ垪琛?
    documents.value.push(newDoc);
    selectDocument(newDoc);

    // 纭繚瀵硅瘽妗嗗叧闂?
    handleUploadDialogClose();

    ElMessage.success(t("openapi.uploadSuccessValidate"));
  } catch (error) {
    console.error("涓婁紶鏂囨。澶辫触:", error);
    ElMessage.error(
      t("openapi.uploadFailed", {
        error: error instanceof Error ? error.message : String(error),
      }),
    );
  } finally {
    uploading.value = false;
  }
};

// 宸ュ叿鍑芥暟
// measureFunction 宸插湪 usePerformanceMonitor() 涓畾涔?
// globalConfirmDelete 宸插湪 useConfirmation() 涓畾涔?

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

// MCP鐩稿叧鏂规硶
const convertToMCP = async () => {
  if (!editorContent.value) {
    ElMessage.warning(t("openapi.selectDocumentFirst"));
    return;
  }

  converting.value = true;
  try {
    const sanitizedContent = sanitizeOpenApiContent(editorContent.value);
    if (sanitizedContent !== editorContent.value) {
      editorContent.value = sanitizedContent;
      if (selectedDocument.value) {
        selectedDocument.value.content = sanitizedContent;
      }
    }

    const validation =
      await openApiStore.validateOpenAPIContent(sanitizedContent);
    if (!validation.valid) {
      ElMessage.error(t("openapi.validateFirst"));
      return;
    }

    const parseResult = await openApiStore.parseOpenAPIContent(sanitizedContent);
    mcpTools.value = parseResult.tools || [];
    activeTab.value = "tools";

    ElMessage.success(
      t("openapi.convertSuccess", { count: mcpTools.value.length }),
    );
  } catch (error) {
    console.error("Converting to MCP failed:", error);
    ElMessage.error(
      t("openapi.convertFailed", {
        error: error instanceof Error ? error.message : String(error),
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

    const authHeaders: Record<string, string> = {};
    if (urlForm.value.authType === "bearer" && urlForm.value.token) {
      authHeaders.Authorization = `Bearer ${urlForm.value.token}`;
    }
    if (
      urlForm.value.authType === "basic" &&
      urlForm.value.username &&
      urlForm.value.password
    ) {
      authHeaders.Authorization = `Basic ${btoa(
        `${urlForm.value.username}:${urlForm.value.password}`,
      )}`;
    }

    const parsedSpec = await openApiAPI.parseOpenAPIFromUrl(
      urlForm.value.url,
      Object.keys(authHeaders).length > 0 ? authHeaders : undefined,
    );

    const normalizedContent = JSON.stringify(
      {
        openapi: parsedSpec.openapi,
        info: parsedSpec.info,
        servers: parsedSpec.servers,
        paths: parsedSpec.paths,
        components: parsedSpec.components,
      },
      null,
      2,
    );

    const createData: CreateDocumentDto = {
      name: urlForm.value.name || "imported_spec",
      description: t("openapi.importedFromUrl"),
      content: normalizedContent,
      status: "valid",
      version: parsedSpec.info?.version || "1.0.0",
      metadata: {
        originalUrl: urlForm.value.url,
        importSource: "url",
        lastValidated: new Date(),
      },
    };

    const newDoc = await documentsApi.createDocument(createData);

    documents.value.push(newDoc);
    selectDocument(newDoc);

    urlForm.value = {
      url: "",
      name: "",
      authType: "none",
      token: "",
      username: "",
      password: "",
    };

    if (urlFormRef.value) {
      urlFormRef.value.resetFields();
      urlFormRef.value.clearValidate();
    }

    showUrlDialog.value = false;

    ElMessage.success(t("openapi.importSuccessValidate"));
  } catch (error) {
    console.error("Importing document from URL failed:", error);
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
    // 杩欓噷鍙互闆嗘垚瀹為檯鐨勫伐鍏锋祴璇曢€昏緫
    console.log("Testing tool:", tool, "with params:", params);
  } catch (error) {
    ElMessage.error(
      t("openapi.testToolFailed", {
        error: error instanceof Error ? error.message : error,
      }),
    );
  }
};

// 鎺ュ彛鐩稿叧鏂规硶
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

// API鍗＄墖灞曞紑/鏀惰捣澶勭悊
const toggleApiDetail = (index: number) => {
  const expandedIndex = expandedApis.value.indexOf(index);
  if (expandedIndex > -1) {
    expandedApis.value.splice(expandedIndex, 1);
  } else {
    expandedApis.value.push(index);
  }
};

// 鍝嶅簲鐘舵€佺爜鏍峰紡绫?
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

// 绐楀彛澶у皬鍙樺寲澶勭悊
const handleResize = () => {
  // 瑙﹀彂璁＄畻灞炴€ч噸鏂拌绠?
  if (editorContainerRef.value) {
    nextTick(() => {
      // 寮哄埗閲嶆柊璁＄畻楂樺害
      editorHeight.value;
    });
  }
};

// 鐢熷懡鍛ㄦ湡
onMounted(async () => {
  // 妫€鏌ョ敤鎴疯璇佺姸鎬佸苟鍔犺浇鏂囨。
  await checkAuthentication();

  // 娣诲姞绐楀彛澶у皬鍙樺寲鐩戝惉鍣?
  window.addEventListener("resize", handleResize);
});

onUnmounted(() => {
  // 娓呯悊绐楀彛澶у皬鍙樺寲鐩戝惉鍣?
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

/* 椤堕儴宸ュ叿鏍忔牱寮?*/
/* 椤甸潰澶撮儴鏍峰紡 */
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

/* 涓昏鍐呭鍖哄煙 */
.manager-content {
  flex: 1;
  padding: 24px 32px;
  overflow: hidden;
}

/* 宸︿晶鏂囨。鍒楄〃鏍峰紡 */
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

/* 鍙充晶璇︽儏鍖哄煙鏍峰紡 */
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

/* 涓婁紶瀵硅瘽妗嗘牱寮?*/
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

/* 瀵硅瘽妗嗘牱寮?*/
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

/* 琛ㄥ崟鏍峰紡澧炲己 */
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

/* 鎸夐挳鏍峰紡澧炲己 */
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

/* 鏍囩鏍峰紡 */
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

/* API琛ㄦ牸鏍峰紡 */
.el-table {
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.05);
}

.el-table th {
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  font-weight: 600;
}

/* 鍝嶅簲寮忚璁?*/
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

/* 婊氬姩鏉℃牱寮?*/
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

/* 鍔ㄧ敾鏁堟灉 */
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

/* 鍗＄墖闃村奖鏁堟灉 */
.document-list-card,
.detail-card {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.document-list-card:hover,
.detail-card:hover {
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.15);
  transform: translateY(-2px);
}

/* API鍒楄〃鏍峰紡 */
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

/* 鏂囦欢鍒楄〃鏍峰紡 */
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

/* API鍗＄墖鏍峰紡 - Swagger UI椋庢牸 */
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

/* API鍗＄墖涓嶅悓鏂规硶鐨勮竟妗嗛鑹?*/
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
