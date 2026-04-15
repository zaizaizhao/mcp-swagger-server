import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { resolve } from "path";
import AutoImport from "unplugin-auto-import/vite";
import Components from "unplugin-vue-components/vite";
import { ElementPlusResolver } from "unplugin-vue-components/resolvers";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    AutoImport({
      resolvers: [ElementPlusResolver()],
      imports: ["vue", "vue-router", "pinia"],
      dts: true,
    }),
    Components({
      resolvers: [ElementPlusResolver()],
      dts: true,
    }),
  ],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  server: {
    port: 3000,
    strictPort: true,
    host: true,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, "/api"),
      },
      "/socket.io": {
        target: "http://localhost:3001",
        changeOrigin: true,
        ws: true,
      },
      "/monitoring": {
        target: "http://localhost:3001",
        changeOrigin: true,
        ws: true,
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("monaco-editor")) {
            return "vendor-monaco";
          }

          if (id.includes("element-plus") || id.includes("@element-plus")) {
            return "vendor-element-plus";
          }

          if (id.includes("echarts") || id.includes("vue-echarts")) {
            return "vendor-charts";
          }

          if (id.includes("socket.io-client")) {
            return "vendor-realtime";
          }

          if (id.includes("/src/modules/monitoring/")) {
            return "feature-monitoring";
          }

          if (id.includes("/src/modules/ai/")) {
            return "feature-ai";
          }

          if (id.includes("/src/modules/config/")) {
            return "feature-config";
          }

          if (id.includes("/src/modules/testing/")) {
            return "feature-testing";
          }

          if (id.includes("/src/modules/openapi/")) {
            return "feature-openapi";
          }

          if (id.includes("/src/modules/servers/")) {
            return "feature-servers";
          }

          if (id.includes("/node_modules/")) {
            return "vendor-misc";
          }
        },
      },
    },
  },
  optimizeDeps: {
    include: ["monaco-editor"],
  },
  define: {
    // Monaco Editor 需要的全局变量
    "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV),
  },
  worker: {
    format: "es",
  },
});
