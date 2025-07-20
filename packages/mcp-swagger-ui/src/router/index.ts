import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import MainLayout from '@/layout/MainLayout.vue'

// 路由配置
const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: MainLayout,
    redirect: '/dashboard',
    children: [
      {
        path: '/dashboard',
        name: 'dashboard',
        component: () => import('@/modules/dashboard/Dashboard.vue'),
        meta: { 
          title: '仪表板',
          icon: 'Monitor',
          description: '系统概览和实时监控'
        }
      },
      {
        path: '/servers',
        name: 'servers',
        component: () => import('@/modules/servers/ServerManager.vue'),
        meta: { 
          title: '服务器管理',
          icon: 'Server',
          description: 'MCP服务器实例管理'
        }
      },
      {
        path: '/servers/:id',
        name: 'server-detail',
        component: () => import('@/modules/servers/ServerDetail.vue'),
        meta: { 
          title: '服务器详情',
          hidden: true,
          parent: 'servers'
        }
      },
      {
        path: '/openapi',
        name: 'openapi',
        component: () => import('@/modules/openapi/OpenAPIManager.vue'),
        meta: { 
          title: 'OpenAPI管理',
          icon: 'Document',
          description: 'OpenAPI规范管理和转换'
        }
      },
      {
        path: '/tester',
        name: 'tester',
        component: () => import('@/modules/testing/APITester.vue'),
        meta: { 
          title: 'API测试',
          icon: 'Tools',
          description: 'MCP工具测试和调试'
        }
      },
      {
        path: '/auth',
        name: 'auth',
        component: () => import('@/modules/auth/AuthManager.vue'),
        meta: { 
          title: '认证管理',
          icon: 'Lock',
          description: 'API认证配置管理'
        }
      },
      {
        path: '/config',
        name: 'config',
        component: () => import('@/modules/config/ConfigManagerNew.vue'),
        meta: { 
          title: '配置管理',
          icon: 'Setting',
          description: '系统配置导入导出'
        }
      },
      {
        path: '/logs',
        name: 'logs',
        component: () => import('@/modules/logs/LogViewer.vue'),
        meta: { 
          title: '日志查看',
          icon: 'List',
          description: '系统日志和调试信息'
        }
      },
      {
        path: '/monitoring',
        name: 'monitoring',
        component: () => import('@/modules/monitoring/monitoring/Dashboard.vue'),
        meta: { 
          title: '系统监控',
          icon: 'Monitor',
          description: '系统性能监控和告警'
        }
      },
      {
        path: '/ai',
        name: 'ai',
        component: () => import('@/modules/ai/AIAssistant.vue'),
        meta: { 
          title: 'AI助手',
          icon: 'ChatDotRound',
          description: 'AI助手集成配置'
        }
      }
    ]
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/NotFound.vue'),
    meta: { 
      title: '页面未找到',
      hidden: true
    }
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return savedPosition
    } else {
      return { top: 0 }
    }
  }
})

// 路由守卫
router.beforeEach((to, from, next) => {
  // 设置页面标题
  if (to.meta?.title) {
    document.title = `${to.meta.title} - MCP Gateway`
  }
  next()
})

export default router
