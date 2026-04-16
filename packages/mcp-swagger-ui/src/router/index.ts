import {
  createRouter,
  createWebHistory,
  type RouteRecordRaw,
} from "vue-router";
import MainLayout from "@/layout/MainLayout.vue";
import Login from "@/views/Login.vue";

const routes: RouteRecordRaw[] = [
  {
    path: "/",
    component: MainLayout,
    redirect: "/servers",
    children: [
      {
        path: "/servers",
        name: "servers",
        component: () => import("@/modules/servers/ServerManager.vue"),
        meta: {
          title: "Server Management",
          icon: "Server",
          description: "Manage MCP server instances",
        },
      },
      {
        path: "/servers/:id",
        name: "server-detail",
        component: () => import("@/modules/servers/ServerDetail.vue"),
        meta: {
          title: "Server Detail",
          hidden: true,
          parent: "servers",
        },
      },
      {
        path: "/openapi",
        name: "openapi",
        component: () => import("@/modules/openapi/OpenAPIManager.vue"),
        meta: {
          title: "OpenAPI Management",
          icon: "Document",
          description: "Manage and convert OpenAPI specs",
        },
      },
      {
        path: "/endpoint-registry",
        name: "endpoint-registry",
        component: () =>
          import("@/modules/endpoint-registry/EndpointRegistry.vue"),
        meta: {
          title: "Endpoint Registry",
          icon: "Document",
          description: "Manage manually registered endpoints by Server URL",
        },
      },
      {
        path: "/tester",
        name: "tester",
        component: () => import("@/modules/testing/APITester.vue"),
        meta: {
          title: "API Testing",
          icon: "Tools",
          description: "Test and debug MCP tools",
        },
      },
      {
        path: "/auth",
        name: "auth",
        component: () => import("@/modules/auth/AuthManager.vue"),
        meta: {
          title: "Authentication",
          icon: "Lock",
          description: "Manage API authentication configuration",
        },
      },
      {
        path: "/config",
        name: "config",
        component: () => import("@/modules/config/ConfigManagerNew.vue"),
        meta: {
          title: "Configuration",
          icon: "Setting",
          description: "Import and export system configuration",
        },
      },
      {
        path: "/logs",
        name: "logs",
        component: () => import("@/modules/logs/LogViewer.vue"),
        meta: {
          title: "Logs",
          icon: "List",
          description: "View system and debug logs",
        },
      },
      {
        path: "/monitoring",
        name: "monitoring",
        component: () =>
          import("@/modules/monitoring/monitoring/Dashboard.vue"),
        meta: {
          title: "Monitoring",
          icon: "Monitor",
          description: "System performance monitoring and alerts",
        },
      },
      {
        path: "/ai",
        name: "ai",
        component: () => import("@/modules/ai/AIAssistant.vue"),
        meta: {
          title: "AI Assistant",
          icon: "ChatDotRound",
          description: "AI assistant integration configuration",
        },
      },
    ],
  },
  {
    path: "/login",
    name: "login",
    component: Login,
    meta: {
      title: "Login",
      hidden: true,
    },
  },
  {
    path: "/:pathMatch(.*)*",
    name: "not-found",
    component: () => import("@/views/NotFound.vue"),
    meta: {
      title: "Not Found",
      hidden: true,
    },
  },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior(_to, _from, savedPosition) {
    return savedPosition || { top: 0 };
  },
});

router.beforeEach(async (to, _from, next) => {
  const { useAuthStore } = await import("@/stores/auth");
  const authStore = useAuthStore();

  const publicRoutes = ["/login", "/forgot-password"];
  const isPublicRoute = publicRoutes.includes(to.path);

  if (to.path === "/login") {
    if (authStore.accessToken && !authStore.currentUser) {
      try {
        await authStore.initializeAuth();
        if (authStore.currentUser) {
          next("/servers");
          return;
        }
      } catch (_error) {
        // Keep login route reachable even if auth init fails
      }
    } else if (authStore.currentUser) {
      next("/servers");
      return;
    }
    next();
    return;
  }

  if (isPublicRoute) {
    next();
    return;
  }

  if (authStore.accessToken && !authStore.currentUser) {
    try {
      await authStore.initializeAuth();
    } catch (_error) {
      // Fallback to auth status check below
    }
  }

  const isAuthenticated = !!authStore.accessToken && !!authStore.currentUser;
  if (!isAuthenticated) {
    next({
      path: "/login",
      query: { redirect: to.fullPath },
    });
    return;
  }

  if (to.meta?.title) {
    document.title = `${to.meta.title} - MCP Gateway`;
  }

  next();
});

export default router;
