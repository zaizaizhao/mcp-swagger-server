<template>
  <div class="server-detail">
    <el-page-header @back="goBack" :content="serverName">
      <template #extra>
        <el-button type="primary" :icon="Edit" @click="editServer">
          编辑服务器
        </el-button>
      </template>
    </el-page-header>
    
    <div class="detail-content">
      <el-card>
        <template #header>
          <span>服务器详情</span>
        </template>
        <p>服务器详情页面开发中...</p>
      </el-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Edit } from '@element-plus/icons-vue'

const route = useRoute()
const router = useRouter()

const serverId = computed(() => route.params.id as string)
const serverName = ref(`服务器 ${serverId.value}`)

const goBack = () => {
  router.push('/servers')
}

const editServer = () => {
  // TODO: 实现编辑服务器功能
  console.log('编辑服务器:', serverId.value)
}
</script>

<style scoped>
.server-detail {
  height: 100%;
}

.detail-content {
  margin-top: 20px;
}
</style>