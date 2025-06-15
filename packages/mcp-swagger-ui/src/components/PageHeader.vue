<template>
  <div class="page-header glass-card">
    <div class="header-content">
      <div class="hero-section">
        <div class="logo-section">
          <div class="logo-icon">🔄</div>
          <h1 class="main-title">
            <span class="gradient-text">MCP Swagger Server</span>
          </h1>
        </div>
        <p class="subtitle">
          将您的 OpenAPI/Swagger 规范转换为 MCP 格式<br>
          让 AI 助手能够与您的 REST API 无缝交互
        </p>
        <div class="features">
          <div class="feature-item">
            <i class="el-icon-connection"></i>
            <span>快速集成</span>
          </div>
          <div class="feature-item">
            <i class="el-icon-cpu"></i>
            <span>智能转换</span>
          </div>
          <div class="feature-item">
            <i class="el-icon-coordinate"></i>
            <span>实时预览</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// 页面头部组件
</script>

<style scoped>
.page-header {
  margin-bottom: var(--spacing-xl);
  padding: var(--spacing-2xl);
  text-align: center;
  position: relative;
  overflow: hidden;
}

.page-header::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, 
    rgba(0, 122, 255, 0.05) 0%, 
    rgba(175, 82, 222, 0.05) 50%,
    rgba(0, 122, 255, 0.03) 100%
  );
  z-index: -1;
}

.header-content {
  max-width: 800px;
  margin: 0 auto;
  position: relative;
  z-index: 1;
}

.hero-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-lg);
}

.logo-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-md);
}

.logo-icon {
  font-size: 4rem;
  line-height: 1;
  filter: drop-shadow(0 4px 8px rgba(0, 122, 255, 0.2));
  animation: pulse 3s ease-in-out infinite;
}

.main-title {
  font-size: clamp(2.5rem, 5vw, 4rem);
  font-weight: 700;
  margin: 0;
  line-height: 1.1;
  letter-spacing: -0.02em;
}

.subtitle {
  font-size: clamp(1.1rem, 2.5vw, 1.3rem);
  color: var(--text-secondary);
  line-height: 1.6;
  margin: 0;
  max-width: 600px;
  font-weight: 400;
}

.features {
  display: flex;
  gap: var(--spacing-xl);
  margin-top: var(--spacing-lg);
  flex-wrap: wrap;
  justify-content: center;
}

.feature-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
  background: rgba(255, 255, 255, 0.6);
  border-radius: var(--radius-medium);
  border: 1px solid var(--border-color);
  backdrop-filter: blur(10px);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  min-width: 120px;
}

.feature-item:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-medium);
  background: rgba(255, 255, 255, 0.8);
}

.feature-item i {
  font-size: 1.5rem;
  color: var(--apple-blue);
}

.feature-item span {
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--text-primary);
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
}

@media (max-width: 768px) {
  .page-header {
    padding: var(--spacing-xl) var(--spacing-lg);
  }
  
  .features {
    gap: var(--spacing-md);
  }
  
  .feature-item {
    min-width: 100px;
    padding: var(--spacing-sm);
  }
  
  .feature-item i {
    font-size: 1.2rem;
  }
  
  .feature-item span {
    font-size: 0.8rem;
  }
}

@media (max-width: 480px) {
  .page-header {
    padding: var(--spacing-lg) var(--spacing-md);
  }
  
  .logo-icon {
    font-size: 3rem;
  }
  
  .features {
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-sm);
  }
  
  .feature-item {
    flex-direction: row;
    justify-content: center;
    min-width: 200px;
  }
}
</style>
