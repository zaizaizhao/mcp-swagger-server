import {
  createRouter,
  createWebHistory,
  type RouteRecordRaw,
} from "vue-router";
import MainLayout from "@/layout/MainLayout.vue";
import Login from "@/views/Login.vue";

// 路由配置
const routes: RouteRecordRaw[] = [
  {
    path: "/",
    component: MainLayout,
    redirect: "/dashboard",
    children: [
      {
        path: "/dashboard",
        name: "dashboard",
        component: () => import("@/modules/dashboard/Dashboard.vue"),
        meta: {
          title: "仪表板",
          icon: "Monitor",
          description: "系统概览和实时监控",
        },
      },
      {
        path: "/servers",
        name: "servers",
        component: () => import("@/modules/servers/ServerManager.vue"),
        meta: {
          title: "服务器管理",
          icon: "Server",
          description: "MCP服务器实例管理",
        },
      },
      {
        path: "/servers/:id",
        name: "server-detail",
        component: () => import("@/modules/servers/ServerDetail.vue"),
        meta: {
          title: "服务器详情",
          hidden: true,
          parent: "servers",
        },
      },
      {
        path: "/openapi",
        name: "openapi",
        component: () => import("@/modules/openapi/OpenAPIManager.vue"),
        meta: {
          title: "OpenAPI管理",
          icon: "Document",
          description: "OpenAPI规范管理和转换",
        },
      },
      {
        path: "/tester",
        name: "tester",
        component: () => import("@/modules/testing/APITester.vue"),
        meta: {
          title: "API测试",
          icon: "Tools",
          description: "MCP工具测试和调试",
        },
      },
      {
        path: "/auth",
        name: "auth",
        component: () => import("@/modules/auth/AuthManager.vue"),
        meta: {
          title: "认证管理",
          icon: "Lock",
          description: "API认证配置管理",
        },
      },
      {
        path: "/config",
        name: "config",
        component: () => import("@/modules/config/ConfigManagerNew.vue"),
        meta: {
          title: "配置管理",
          icon: "Setting",
          description: "系统配置导入导出",
        },
      },
      {
        path: "/logs",
        name: "logs",
        component: () => import("@/modules/logs/LogViewer.vue"),
        meta: {
          title: "日志查看",
          icon: "List",
          description: "系统日志和调试信息",
        },
      },
      {
        path: "/monitoring",
        name: "monitoring",
        component: () =>
          import("@/modules/monitoring/monitoring/Dashboard.vue"),
        meta: {
          title: "系统监控",
          icon: "Monitor",
          description: "系统性能监控和告警",
        },
      },
      {
        path: "/ai",
        name: "ai",
        component: () => import("@/modules/ai/AIAssistant.vue"),
        meta: {
          title: "AI助手",
          icon: "ChatDotRound",
          description: "AI助手集成配置",
        },
      },
    ],
  },
  {
    path: "/login",
    name: "login",
    component: Login,
    meta: {
      title: "登录",
      hidden: true,
    },
  },

  {
    path: "/:pathMatch(.*)*",
    name: "not-found",
    component: () => import("@/views/NotFound.vue"),
    meta: {
      title: "页面未找到",
      hidden: true,
    },
  },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return savedPosition;
    } else {
      return { top: 0 };
    }
  },
});

// 路由守卫
router.beforeEach(async (to, from, next) => {
  // 动态导入 auth store 以避免循环依赖
  const { useAuthStore } = await import("@/stores/auth");
  const authStore = useAuthStore();

  console.log("路由守卫 - 目标路径:", to.path);
  console.log("路由守卫 - accessToken:", !!authStore.accessToken);
  console.log("路由守卫 - currentUser:", !!authStore.currentUser);

  // 公开路由（不需要认证）
  const publicRoutes = ["/login", "/forgot-password"];
  const isPublicRoute = publicRoutes.includes(to.path);

  // 如果是登录页面
  if (to.path === "/login") {
    // 检查是否需要初始化认证状态（只在有token但没有用户信息时）
    if (authStore.accessToken && !authStore.currentUser) {
      console.log("登录页面 - 检测到 token 但无用户信息，尝试初始化认证状态");
      try {
        await authStore.initializeAuth();
        console.log(
          "登录页面 - 认证初始化完成 - currentUser:",
          !!authStore.currentUser,
        );
        // 如果初始化后有用户信息，重定向到仪表板
        if (authStore.currentUser) {
          console.log("登录页面 - 用户已认证，重定向到仪表板");
          next("/dashboard");
          return;
        }
      } catch (error) {
        console.error("登录页面 - 认证初始化失败:", error);
      }
    } else if (authStore.currentUser) {
      // 如果已经有用户信息，重定向到仪表板
      console.log("登录页面 - 用户已认证，重定向到仪表板");
      next("/dashboard");
      return;
    }
    // 允许访问登录页面
    console.log("登录页面 - 允许访问");
    next();
    return;
  }

  // 其他公开路由直接通过
  if (isPublicRoute) {
    next();
    return;
  }

  // 对于需要认证的路由，先检查是否需要初始化认证状态
  if (authStore.accessToken && !authStore.currentUser) {
    console.log("受保护路由 - 检测到 token 但无用户信息，开始初始化认证状态");
    try {
      await authStore.initializeAuth();
      console.log(
        "受保护路由 - 认证初始化完成 - currentUser:",
        !!authStore.currentUser,
      );
    } catch (error) {
      console.error("受保护路由 - 认证初始化失败:", error);
    }
  }

  // 最终检查认证状态：必须同时有 accessToken 和 currentUser
  const isAuthenticated = !!authStore.accessToken && !!authStore.currentUser;
  console.log("受保护路由 - 最终认证状态检查:", {
    hasToken: !!authStore.accessToken,
    hasUser: !!authStore.currentUser,
    isAuthenticated,
  });

  if (!isAuthenticated) {
    console.log("用户未认证，重定向到登录页面");
    // 重定向到登录页面
    next({
      path: "/login",
      query: { redirect: to.fullPath },
    });
    return;
  }

  console.log("用户已认证，允许访问");

  // 设置页面标题
  if (to.meta?.title) {
    document.title = `${to.meta.title} - MCP Gateway`;
  }

  // 已认证，允许访问
  next();
});

export default router;
