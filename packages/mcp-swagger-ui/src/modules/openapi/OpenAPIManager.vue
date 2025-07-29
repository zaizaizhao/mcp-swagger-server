<template>
  <div class="openapi-manager">
    <!-- 页面头部 -->
    <div class="header-section">
      <div class="header-content">
        <h1>
          <el-icon><Document /></el-icon>
          OpenAPI 文档管理
        </h1>
        <p class="header-description">管理和编辑OpenAPI规范文档，支持文档上传、在线编辑和MCP工具转换</p>
      </div>
      <div class="header-actions">
        <el-button type="primary" @click="showUploadDialog = true" :icon="Upload">
          上传文档
        </el-button>
        <el-button type="success" @click="showUrlDialog = true" :icon="Link">
          从URL导入
        </el-button>
        <el-button @click="refreshDocuments" :loading="loading" :icon="Refresh">
          刷新
        </el-button>
      </div>
    </div>

    <!-- 主要内容区域 -->
    <div class="manager-content">
      <el-row :gutter="24" style="height: calc(100vh - 80px);">
        <!-- 左侧：文档列表 -->
        <el-col :span="8">
          <el-card shadow="always" class="document-list-card" style="height: 100%;">
            <template #header>
              <div class="list-header">
                <span>
                   <el-icon><Folder /></el-icon>
                   文档列表 ({{ documents.length }})
                 </span>
              </div>
            </template>
          
          <!-- 搜索框 -->
          <div class="search-container">
            <el-input
              v-model="searchQuery"
              placeholder="搜索文档..."
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
            <el-empty v-if="!filteredDocuments.length" description="暂无文档，请上传OpenAPI文档" />
            <div v-else class="document-items">
              <div 
                v-for="doc in filteredDocuments" 
                :key="doc.id"
                class="document-item"
                :class="{ active: selectedDocument?.id === doc.id }"
                @click="selectDocument(doc)"
              >
                <div class="document-info">
                  <div class="document-name">{{ doc.name }}</div>
                  <div class="document-meta">
                    <span class="upload-time">{{ formatDate(doc.uploadTime) }}</span>
                    <el-tag 
                      :type="doc.status === 'valid' ? 'success' : doc.status === 'invalid' ? 'danger' : 'warning'"
                      size="small"
                    >
                      {{ getStatusText(doc.status) }}
                    </el-tag>
                  </div>
                </div>
                <div class="document-actions">
                  <el-button-group size="small">
                    <el-button @click.stop="editDocument(doc)">
                      <el-icon><Edit /></el-icon>
                    </el-button>
                    <el-button @click.stop="deleteDocument(doc.id)">
                      <el-icon><Delete /></el-icon>
                    </el-button>
                  </el-button-group>
                </div>
              </div>
            </div>
          </div>
        </el-card>
        </el-col>
      
        <!-- 右侧：文档详情 -->
        <el-col :span="16">
          <el-card shadow="always" class="detail-card" style="height: 100%;">
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
                      :disabled="selectedDocument.status !== 'valid'"
                    >
                      <el-icon><Edit /></el-icon>
                      编辑
                    </el-button>
                    <el-button 
                      :type="activeTab === 'preview' ? 'primary' : ''"
                      size="small" 
                      @click="activeTab = 'preview'"
                      :disabled="selectedDocument.status !== 'valid'"
                    >
                      <el-icon><Document /></el-icon>
                      预览
                    </el-button>
                    <el-button 
                      :type="activeTab === 'apis' ? 'primary' : ''"
                      size="small" 
                      @click="activeTab = 'apis'"
                      :disabled="selectedDocument.status !== 'valid'"
                    >
                      <el-icon><Operation /></el-icon>
                      接口列表
                    </el-button>
                    <el-button 
                      :type="activeTab === 'tools' ? 'primary' : ''"
                      size="small" 
                      @click="activeTab = 'tools'"
                      :disabled="selectedDocument.status !== 'valid'"
                    >
                      <el-icon><Tools /></el-icon>
                      MCP工具
                    </el-button>
                  </el-button-group>
                  <el-divider direction="vertical" />
                  <el-button size="small" @click="validateSpec" :disabled="!selectedDocument || !editorContent.trim()">
                    <el-icon><Check /></el-icon>
                    验证
                  </el-button>
                  <el-button type="primary" size="small" @click="convertToMCP" :disabled="selectedDocument.status !== 'valid'">
                     <el-icon><Setting /></el-icon>
                     转换为MCP
                   </el-button>
                  <el-button 
                    type="primary" 
                    size="small" 
                    @click="downloadSpec"
                    :disabled="selectedDocument.status !== 'valid'"
                  >
                    <el-icon><Download /></el-icon>
                    下载
                  </el-button>
                </div>
              </div>
              <div v-else class="empty-header">
                <span>
                  <el-icon><Document /></el-icon>
                  请选择一个文档查看详情
                </span>
              </div>
            </template>

          <div class="detail-content" style="height: calc(100% - 60px); overflow: hidden;">
            <!-- 空状态 -->
            <div v-if="!selectedDocument" class="empty-state" style="height: 100%; display: flex; align-items: center; justify-content: center;">
              <el-empty description="请选择一个文档查看详情" :image-size="150">
                <el-button type="primary" @click="showUploadDialog = true" :icon="Upload">
                  上传文档
                </el-button>
              </el-empty>
            </div>
            
            <!-- 错误状态 -->
            <div v-else-if="selectedDocument.status === 'error'" class="error-state" style="height: 100%; display: flex; align-items: center; justify-content: center;">
              <el-result icon="error" title="文档解析失败" :sub-title="selectedDocument.errorMessage">
                <template #extra>
                  <el-button type="primary" @click="deleteDocument(selectedDocument.id)">
                    删除文档
                  </el-button>
                </template>
              </el-result>
            </div>
            
            <!-- 加载状态 -->
            <div v-else-if="selectedDocument.status === 'loading'" class="loading-state" style="height: 100%; display: flex; align-items: center; justify-content: center;">
              <div style="text-align: center;">
                <el-icon size="48" class="is-loading" style="margin-bottom: 16px;">
                  <Loading />
                </el-icon>
                <p style="color: #606266; margin: 0;">正在解析文档...</p>
              </div>
            </div>
            
            <!-- 正常状态 -->
            <div v-else class="content-tabs" style="height: 100%;">
              <div v-show="activeTab === 'editor'" class="editor-container" style="height: 100%;">
                <MonacoEditor
                  v-model="editorContent"
                  language="yaml"
                  :height="600"
                  @change="handleContentChange"
                />
              </div>
              
              <div v-show="activeTab === 'preview'" class="preview-container" style="height: 100%; overflow-y: auto;">
                <SpecPreview 
                  :spec="selectedDocument" 
                  :validation-result="validationResults"
                  :api-paths="parsedApis"
                  :mcp-tools="mcpTools"
                />
              </div>
              
              <div v-show="activeTab === 'apis'" class="apis-container" style="height: 100%; overflow-y: auto;">
                <el-empty v-if="!parsedApis.length" description="暂无解析结果，请先验证文档" />
                <div v-else>
                  <!-- API列表内容 -->
                  <el-table 
                    :data="parsedApis"
                    stripe
                    style="width: 100%"
                    max-height="500"
                  >
                    <el-table-column prop="method" label="方法" width="80">
                      <template #default="{ row }">
                        <el-tag 
                          :type="getMethodTagType(row.method)"
                          size="small"
                        >
                          {{ row.method.toUpperCase() }}
                        </el-tag>
                      </template>
                    </el-table-column>
                    
                    <el-table-column prop="path" label="路径" min-width="200" />
                    
                    <el-table-column prop="summary" label="摘要" min-width="150" show-overflow-tooltip />
                    
                    <el-table-column prop="description" label="描述" min-width="200" show-overflow-tooltip />
                    
                    <el-table-column prop="tags" label="标签" width="120">
                      <template #default="{ row }">
                        <el-tag 
                          v-for="tag in row.tags" 
                          :key="tag"
                          size="small"
                          effect="plain"
                          style="margin-right: 4px;"
                        >
                          {{ tag }}
                        </el-tag>
                      </template>
                    </el-table-column>
                    
                    <el-table-column label="操作" width="100">
                      <template #default="{ row }">
                        <el-button 
                          size="small"
                          type="primary"
                          text
                          @click="viewApiDetail(row)"
                        >
                          详情
                        </el-button>
                      </template>
                    </el-table-column>
                  </el-table>
                </div>
              </div>
              
              <div v-show="activeTab === 'tools'" class="tools-container" style="height: 100%; overflow-y: auto;">
                <MCPToolPreview :tools="mcpTools" />
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
      title="创建新的OpenAPI规范"
      width="600px"
      align-center
    >
      <el-form 
        ref="createFormRef"
        :model="createForm"
        :rules="createFormRules"
        label-width="100px"
      >
        <el-form-item label="规范名称" prop="name">
          <el-input 
            v-model="createForm.name"
            placeholder="请输入规范名称"
            clearable
          />
        </el-form-item>
        
        <el-form-item label="版本" prop="version">
          <el-input 
            v-model="createForm.version"
            placeholder="请输入版本号，如 1.0.0"
            clearable
          />
        </el-form-item>
        
        <el-form-item label="描述" prop="description">
          <el-input 
            v-model="createForm.description"
            type="textarea"
            :rows="3"
            placeholder="请输入描述信息"
          />
        </el-form-item>
        
        <el-form-item label="模板">
          <el-select 
            v-model="createForm.template"
            placeholder="选择模板（可选）"
            clearable
            style="width: 100%;"
          >
            <el-option label="空白模板" value="blank" />
            <el-option label="基础REST API" value="basic-rest" />
            <el-option label="电商API" value="ecommerce" />
            <el-option label="用户管理API" value="user-management" />
          </el-select>
        </el-form-item>
      </el-form>
      
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button 
          type="primary" 
          @click="createNewSpec"
          :loading="creating"
        >
          创建
        </el-button>
      </template>
    </el-dialog>

    <!-- 上传对话框 -->
    <el-dialog
      v-model="showUploadDialog"
      title="上传OpenAPI文档"
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
          :accept="'.json,.yaml,.yml'"
          :limit="1"
        >
          <el-icon class="el-icon--upload" size="48" style="color: #409eff;"><UploadFilled /></el-icon>
          <div class="el-upload__text" style="font-size: 16px; margin-top: 16px;">
            拖拽文件到此处或 <em style="color: #409eff;">点击选择文件</em>
          </div>
          <template #tip>
            <div class="el-upload__tip" style="margin-top: 12px; color: #909399;">
              支持 JSON 和 YAML 格式的 OpenAPI 规范文档
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
          <el-form-item label="文档名称" prop="name">
            <el-input v-model="uploadForm.name" placeholder="请输入文档名称" size="large">
              <template #prefix>
                <el-icon><Document /></el-icon>
              </template>
            </el-input>
          </el-form-item>
          <el-form-item label="文档描述" prop="description">
            <el-input 
              v-model="uploadForm.description" 
              type="textarea" 
              :rows="3"
              placeholder="请输入文档描述（可选）"
              size="large"
            />
          </el-form-item>
        </el-form>
      </div>
      
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="handleUploadDialogClose" size="large">取消</el-button>
          <el-button 
            type="primary" 
            @click="confirmUpload" 
            :disabled="!uploadFile"
            size="large"
            :loading="uploading"
          >
            {{ uploading ? '上传中...' : '确认上传' }}
          </el-button>
        </div>
      </template>
    </el-dialog>

    <!-- URL导入对话框 -->
    <el-dialog
      v-model="showUrlDialog"
      title="从URL导入OpenAPI文档"
      width="600px"
      align-center
    >
      <el-form 
        ref="urlFormRef"
        :model="urlForm"
        :rules="urlFormRules"
        label-width="100px"
      >
        <el-form-item label="文档URL" prop="url">
          <el-input 
            v-model="urlForm.url"
            placeholder="请输入OpenAPI文档的URL地址"
            clearable
            size="large"
          >
            <template #prefix>
              <el-icon><Link /></el-icon>
            </template>
          </el-input>
          <div class="form-tip">
            支持 HTTP/HTTPS 协议的 JSON 或 YAML 格式文档
          </div>
        </el-form-item>
        
        <el-form-item label="文档名称" prop="name">
          <el-input 
            v-model="urlForm.name"
            placeholder="请输入文档名称"
            clearable
            size="large"
          >
            <template #prefix>
              <el-icon><Edit /></el-icon>
            </template>
          </el-input>
          <div class="form-tip">
            如果不填写，将使用文档中的标题信息
          </div>
        </el-form-item>
        
        <el-form-item label="认证方式">
          <el-select v-model="urlForm.authType" placeholder="选择认证方式" size="large" style="width: 100%;">
            <el-option label="无需认证" value="none" />
            <el-option label="Bearer Token" value="bearer" />
            <el-option label="Basic Auth" value="basic" />
          </el-select>
        </el-form-item>
        
        <el-form-item v-if="urlForm.authType === 'bearer'" label="Token">
          <el-input 
            v-model="urlForm.token"
            type="password"
            placeholder="请输入Bearer Token"
            show-password
            size="large"
          />
        </el-form-item>
        
        <template v-if="urlForm.authType === 'basic'">
          <el-form-item label="用户名">
            <el-input 
              v-model="urlForm.username"
              placeholder="请输入用户名"
              size="large"
            />
          </el-form-item>
          
          <el-form-item label="密码">
            <el-input 
              v-model="urlForm.password"
              type="password"
              placeholder="请输入密码"
              show-password
              size="large"
            />
          </el-form-item>
        </template>
      </el-form>
      
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="showUrlDialog = false" size="large">取消</el-button>
          <el-button 
            type="primary" 
            @click="importFromUrl"
            :loading="importing"
            size="large"
          >
            {{ importing ? '导入中...' : '开始导入' }}
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.openapi-manager {
  height: 100vh;
  background: linear-gradient(180deg, var(--bg-secondary) 0%, var(--bg-tertiary) 100%);
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
  align-items: center;
  position: relative;
  overflow: hidden;
}

.document-item::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, rgba(0, 122, 255, 0.1) 0%, rgba(0, 81, 208, 0.1) 100%);
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

.document-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.upload-time {
  font-size: 12px;
  color: var(--text-secondary);
  background: var(--bg-quaternary);
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-small);
}

.document-actions {
  margin-left: 12px;
  position: relative;
  z-index: 1;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.document-item:hover .document-actions {
  opacity: 1;
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

.preview-container,
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
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, rgba(0, 122, 255, 0.1) 0%, rgba(0, 81, 208, 0.1) 100%);
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
  background: linear-gradient(135deg, var(--apple-blue) 0%, var(--apple-blue-dark) 100%);
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
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0.1) 100%);
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
  background: linear-gradient(135deg, rgba(103, 194, 58, 0.2) 0%, rgba(139, 195, 74, 0.2) 100%);
  color: #67c23a;
}

.el-tag--danger {
  background: linear-gradient(135deg, rgba(245, 108, 108, 0.2) 0%, rgba(244, 67, 54, 0.2) 100%);
  color: #f56c6c;
}

.el-tag--warning {
  background: linear-gradient(135deg, rgba(230, 162, 60, 0.2) 0%, rgba(255, 193, 7, 0.2) 100%);
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
  background: linear-gradient(135deg, rgba(103, 194, 58, 0.1) 0%, rgba(139, 195, 74, 0.1) 100%);
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
</style>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Plus, Upload, Link, Document, Search, MoreFilled, Edit, 
  DocumentCopy, Download, Delete, Operation, Tools, Check, 
  DocumentChecked, UploadFilled, Folder, Setting
} from '@element-plus/icons-vue'
import type { UploadFile, FormInstance } from 'element-plus'
import MonacoEditor from '../../shared/components/monaco/MonacoEditor.vue'
import SpecPreview from './components/openapi/SpecPreview.vue'
import MCPToolPreview from './components/openapi/MCPToolPreview.vue'
import type { OpenAPISpec, ValidationResult, MCPTool } from '../../types'
import { useOpenAPIStore } from '../../stores/openapi'
import { parseOpenAPI, validateOpenAPI } from '../../utils/openapi'

// 导入全局功能
import { useConfirmation } from '../../composables/useConfirmation'
import { useFormValidation } from '../../composables/useFormValidation'
import { usePerformanceMonitor } from '../../composables/usePerformance'
// import LoadingOverlay from '@/shared/components/ui/LoadingOverlay.vue' // 暂时注释掉，如果需要可以创建这个组件

// 状态管理
const openApiStore = useOpenAPIStore()

// 全局功能
const { 
  confirmDelete: globalConfirmDelete, 
  confirmDangerousAction,
  confirmSave 
} = useConfirmation()

const { 
  startMonitoring,
  stopMonitoring,
  measureFunction 
} = usePerformanceMonitor()

// 响应式数据
const specsLoading = ref(false)
const loading = ref(false)
const searchQuery = ref('')
const selectedDocument = ref<any>(null)
const activeTab = ref<'editor' | 'preview' | 'apis' | 'tools'>('editor')
const editorContent = ref('')
const saving = ref(false)
const validating = ref(false)
const converting = ref(false)
const validationResults = ref<ValidationResult | null>(null)
const mcpTools = ref<any[]>([])  // MCP工具列表
const documents = ref<any[]>([])  // 文档列表
const parsedApis = ref<any[]>([])  // 解析的API列表
const uploadFile = ref<File | null>(null)

// 对话框状态
const showCreateDialog = ref(false)
const showUploadDialog = ref(false)
const showUrlDialog = ref(false)
const creating = ref(false)
const uploading = ref(false)
const importing = ref(false)

// 表单引用
const createFormRef = ref<FormInstance>()
const urlFormRef = ref<FormInstance>()
const uploadRef = ref()

// 上传文件列表
const uploadFileList = ref<UploadFile[]>([])

// 表单数据
const createForm = ref({
  name: '',
  version: '1.0.0',
  description: '',
  template: ''
})

const uploadForm = ref({
  name: '',
  description: ''
})

const urlForm = ref({
  url: '',
  name: '',
  authType: 'none',
  token: '',
  username: '',
  password: ''
})

// 表单验证规则
const createFormRules = {
  name: [
    { required: true, message: '请输入规范名称', trigger: 'blur' },
    { min: 2, max: 50, message: '名称长度在 2 到 50 个字符', trigger: 'blur' }
  ],
  version: [
    { required: true, message: '请输入版本号', trigger: 'blur' }
  ]
}

const uploadRules = {
  name: [
    { required: true, message: '请输入文档名称', trigger: 'blur' },
    { min: 2, max: 50, message: '名称长度在 2 到 50 个字符', trigger: 'blur' }
  ]
}

const urlFormRules = {
  url: [
    { required: true, message: '请输入URL地址', trigger: 'blur' },
    { type: 'url', message: '请输入有效的URL地址', trigger: 'blur' }
  ],
  name: [
    { required: true, message: '请输入规范名称', trigger: 'blur' }
  ]
}

// Monaco编辑器选项
const editorOptions = {
  theme: 'vs-dark',
  fontSize: 14,
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  automaticLayout: true,
  tabSize: 2,
  wordWrap: 'on' as const
}

// 计算属性
const filteredDocuments = computed(() => {
  if (!searchQuery.value) return documents.value
  
  const query = searchQuery.value.toLowerCase()
  return documents.value.filter(doc =>
    doc.name.toLowerCase().includes(query) ||
    doc.description?.toLowerCase().includes(query)
  )
})

// 方法
const formatDate = (date: Date | string) => {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(dateObj)
}

const selectDocument = (doc: any) => {
  selectedDocument.value = doc
  editorContent.value = doc.content || ''
  validationResults.value = null
  activeTab.value = 'editor'
}

const editDocument = (doc: any) => {
  selectDocument(doc)
  activeTab.value = 'editor'
}

const deleteDocument = async (docId: string) => {
  try {
    const confirmed = await globalConfirmDelete('此文档')
    if (!confirmed) return
    
    documents.value = documents.value.filter(doc => doc.id !== docId)
    if (selectedDocument.value?.id === docId) {
      selectedDocument.value = null
      editorContent.value = ''
    }
    ElMessage.success('文档删除成功')
  } catch (error) {
    ElMessage.error(`删除失败: ${error}`)
  }
}

const refreshDocuments = async () => {
  try {
    loading.value = true
    await openApiStore.fetchSpecs()
    // 这里可以添加从store获取文档列表的逻辑
    ElMessage.success('文档列表刷新成功')
  } catch (error) {
    ElMessage.error(`刷新失败: ${error}`)
  } finally {
    loading.value = false
  }
}

const getStatusText = (status: string) => {
  const statusMap: Record<string, string> = {
    'valid': '有效',
    'invalid': '无效',
    'pending': '待验证'
  }
  return statusMap[status] || '未知'
}

const handleSpecAction = async (command: { action: string; spec: OpenAPISpec }) => {
  const { action, spec } = command
  
  switch (action) {
    case 'edit':
      // 选择文档进行编辑
      const doc = documents.value.find(d => d.id === spec.id)
      if (doc) {
        selectDocument(doc)
        activeTab.value = 'editor'
      }
      break
      
    case 'duplicate':
      try {
        await openApiStore.duplicateSpec(spec.id)
        ElMessage.success('规范复制成功')
      } catch (error) {
        ElMessage.error(`复制失败: ${error}`)
      }
      break
      
    case 'download':
      downloadSpec(spec)
      break
      
    case 'delete':
      try {
        const confirmed = await globalConfirmDelete(spec.name)
        if (!confirmed) break
        
        await measureFunction('deleteSpec', async () => {
          await openApiStore.deleteSpec(spec.id)
        })
        
        // 如果删除的是当前选中的文档，清空选择
        if (selectedDocument.value?.id === spec.id) {
          selectedDocument.value = null
          editorContent.value = ''
        }
        // 从文档列表中移除
        documents.value = documents.value.filter(doc => doc.id !== spec.id)
        ElMessage.success('规范删除成功')
      } catch (error) {
        ElMessage.error(`删除失败: ${error}`)
      }
      break
  }
}

const downloadSpec = (spec?: OpenAPISpec) => {
  const content = spec?.content || editorContent.value
  if (!content) {
    ElMessage.warning('请先输入OpenAPI规范内容')
    return
  }
  
  const blob = new Blob([content], {
    type: 'application/yaml'
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = spec ? `${spec.name}-${spec.version}.yaml` : `openapi-spec-${new Date().getTime()}.yaml`
  link.click()
  URL.revokeObjectURL(url)
  ElMessage.success('下载成功')
}

const handleContentChange = (content: string) => {
  editorContent.value = content
  if (selectedDocument.value) {
    selectedDocument.value.content = content
  }
  validationResults.value = null
}

const validateSpec = async () => {
  if (!editorContent.value.trim()) {
    ElMessage.warning('请先输入OpenAPI规范内容')
    return
  }
  
  validating.value = true
  try {
    const result = await measureFunction('validateSpec', async () => {
      return await openApiStore.validateSpec(editorContent.value)
    })
    
    // 更新验证结果
    validationResults.value = result
    
    // 更新文档状态
    if (selectedDocument.value) {
      selectedDocument.value.status = result.valid ? 'valid' : 'invalid'
    }
    
    // 显示验证结果消息
    if (result.valid) {
      const warningCount = result.warnings?.length || 0
      if (warningCount > 0) {
        ElMessage.success(`规范验证通过，但有 ${warningCount} 个警告`)
      } else {
        ElMessage.success('规范验证通过，无错误和警告')
      }
    } else {
      const errorCount = result.errors?.length || 0
      const warningCount = result.warnings?.length || 0
      let message = `规范验证失败，发现 ${errorCount} 个错误`
      if (warningCount > 0) {
        message += `，${warningCount} 个警告`
      }
      ElMessage.error(message)
    }
    
    // 如果有验证结果，自动切换到预览标签页以显示详细信息
    if (result.errors?.length > 0 || result.warnings?.length > 0) {
      activeTab.value = 'preview'
    }
    
  } catch (error) {
    console.error('验证失败:', error)
    ElMessage.error(`验证失败: ${error instanceof Error ? error.message : String(error)}`)
    validationResults.value = null
    if (selectedDocument.value) {
      selectedDocument.value.status = 'invalid'
    }
  } finally {
    validating.value = false
  }
}

// downloadSpec 函数已在上面定义，删除重复声明

const createNewSpec = async () => {
  if (!createFormRef.value) return
  
  try {
    await createFormRef.value.validate()
    creating.value = true
    
    const newDoc = {
      id: Date.now().toString(),
      name: createForm.value.name,
      version: createForm.value.version,
      description: createForm.value.description,
      content: generateTemplateContent(createForm.value.template),
      uploadTime: new Date(),
      status: 'pending'
    }
    
    documents.value.push(newDoc)
    selectDocument(newDoc)
    showCreateDialog.value = false
    
    // 重置表单
    createForm.value = {
      name: '',
      version: '1.0.0',
      description: '',
      template: ''
    }
    
    ElMessage.success('文档创建成功')
  } catch (error) {
    ElMessage.error(`创建失败: ${error}`)
  } finally {
    creating.value = false
  }
}

const generateTemplateContent = (template: string) => {
  const templates: Record<string, string> = {
    'blank': `openapi: 3.0.0
info:
  title: ${createForm.value.name}
  version: ${createForm.value.version}
  description: ${createForm.value.description}
paths: {}
`,
    'basic-rest': `openapi: 3.0.0
info:
  title: ${createForm.value.name}
  version: ${createForm.value.version}
  description: ${createForm.value.description}
paths:
  /users:
    get:
      summary: 获取用户列表
      responses:
        '200':
          description: 成功
`,
    'ecommerce': `openapi: 3.0.0
info:
  title: ${createForm.value.name}
  version: ${createForm.value.version}
  description: ${createForm.value.description}
paths:
  /products:
    get:
      summary: 获取商品列表
      responses:
        '200':
          description: 成功
`,
    'user-management': `openapi: 3.0.0
info:
  title: ${createForm.value.name}
  version: ${createForm.value.version}
  description: ${createForm.value.description}
paths:
  /auth/login:
    post:
      summary: 用户登录
      responses:
        '200':
          description: 登录成功
`
  }
  return templates[template] || templates['blank']
}

const handleFileChange = (file: UploadFile) => {
  uploadFile.value = file.raw || null
  if (uploadFile.value) {
    uploadForm.value.name = uploadFile.value.name.replace(/\.[^/.]+$/, '')
  }
}

const handleUploadDialogClose = () => {
  showUploadDialog.value = false
  uploadFile.value = null
  uploadForm.value = { name: '', description: '' }
}

const confirmUpload = async () => {
  if (!uploadFile.value) return
  
  try {
    const content = await readFileContent(uploadFile.value)
    const newDoc = {
      id: Date.now().toString(),
      name: uploadForm.value.name,
      description: uploadForm.value.description,
      content,
      uploadTime: new Date(),
      status: 'pending'
    }
    
    documents.value.push(newDoc)
    selectDocument(newDoc)
    handleUploadDialogClose()
    
    ElMessage.success('文档上传成功')
  } catch (error) {
    ElMessage.error(`上传失败: ${error}`)
  }
}





// 工具函数
// measureFunction 已在 usePerformanceMonitor() 中定义
// globalConfirmDelete 已在 useConfirmation() 中定义

const readFileContent = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      resolve(e.target?.result as string)
    }
    reader.onerror = () => {
      reject(new Error('文件读取失败'))
    }
    reader.readAsText(file)
  })
}

// MCP相关方法
const convertToMCP = async () => {
  if (!editorContent.value) {
    ElMessage.warning('请先选择文档或输入OpenAPI规范内容')
    return
  }
  
  converting.value = true
  try {
    // 首先验证当前规范
    const validation = await openApiStore.validateSpec(editorContent.value)
    if (!validation.valid) {
      ElMessage.error('当前规范验证失败，请先修复错误')
      return
    }
    
    // 解析内容并获取工具
    const parseResult = await openApiStore.parseOpenAPIContent(editorContent.value)
    mcpTools.value = parseResult.tools || []
    activeTab.value = 'tools'
    
    ElMessage.success(`成功转换为 ${mcpTools.value.length} 个MCP工具`)
  } catch (error) {
    ElMessage.error(`转换失败: ${error instanceof Error ? error.message : error}`)
  } finally {
    converting.value = false
  }
}

const importFromUrl = async () => {
  if (!urlFormRef.value) return
  
  try {
    await urlFormRef.value.validate()
    importing.value = true
    
    const authHeaders: Record<string, string> = {}
    
    if (urlForm.value.authType === 'bearer' && urlForm.value.token) {
      authHeaders['Authorization'] = `Bearer ${urlForm.value.token}`
    } else if (urlForm.value.authType === 'basic' && urlForm.value.username && urlForm.value.password) {
      const credentials = btoa(`${urlForm.value.username}:${urlForm.value.password}`)
      authHeaders['Authorization'] = `Basic ${credentials}`
    }

    const response = await fetch(urlForm.value.url, { headers: authHeaders })
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const content = await response.text()
    const newDoc = {
      id: Date.now().toString(),
      name: urlForm.value.name || 'imported_spec',
      description: '从URL导入的文档',
      content,
      uploadTime: new Date(),
      status: 'pending'
    }
    
    documents.value.push(newDoc)
    selectDocument(newDoc)
    showUrlDialog.value = false
    
    // 重置表单
    urlForm.value = {
      url: '',
      name: '',
      authType: 'none',
      token: '',
      username: '',
      password: ''
    }
    
    ElMessage.success('文档导入成功')
  } catch (error) {
    ElMessage.error(`导入失败: ${error}`)
  } finally {
    importing.value = false
  }
}

const handleTestTool = async (tool: MCPTool, params: Record<string, any>) => {
  try {
    ElMessage.info(`正在测试工具: ${tool.name}`)
    // 这里可以集成实际的工具测试逻辑
    console.log('Testing tool:', tool, 'with params:', params)
  } catch (error) {
    ElMessage.error(`工具测试失败: ${error instanceof Error ? error.message : error}`)
  }
}

// 接口相关方法
const getMethodTagType = (method: string) => {
  const methodMap: Record<string, string> = {
    'get': 'success',
    'post': 'primary',
    'put': 'warning',
    'delete': 'danger',
    'patch': 'info',
    'head': '',
    'options': ''
  }
  return methodMap[method.toLowerCase()] || ''
}

const viewApiDetail = (api: any) => {
  ElMessageBox.alert(
    `<div>
      <p><strong>路径:</strong> ${api.path}</p>
      <p><strong>方法:</strong> ${api.method.toUpperCase()}</p>
      <p><strong>摘要:</strong> ${api.summary || '无'}</p>
      <p><strong>描述:</strong> ${api.description || '无'}</p>
      <p><strong>操作ID:</strong> ${api.operationId || '无'}</p>
      <p><strong>标签:</strong> ${api.tags?.join(', ') || '无'}</p>
    </div>`,
    '接口详情',
    {
      dangerouslyUseHTMLString: true,
      confirmButtonText: '确定'
    }
  )
}

// 生命周期
onMounted(async () => {
  // 暂时移除规范列表加载，直接使用解析功能
  specsLoading.value = false
})
</script>