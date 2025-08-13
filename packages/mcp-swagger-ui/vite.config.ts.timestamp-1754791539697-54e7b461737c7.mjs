// vite.config.ts
import { defineConfig } from "file:///E:/demo/mcp/mcp-swagger-server/node_modules/.pnpm/vite@5.4.19_@types+node@20.19.1_terser@5.43.1/node_modules/vite/dist/node/index.js";
import vue from "file:///E:/demo/mcp/mcp-swagger-server/node_modules/.pnpm/@vitejs+plugin-vue@4.6.2_vi_6e2db9735746870408ac73bfac3de572/node_modules/@vitejs/plugin-vue/dist/index.mjs";
import { resolve } from "path";
import AutoImport from "file:///E:/demo/mcp/mcp-swagger-server/node_modules/.pnpm/unplugin-auto-import@0.16.7_fcab70ba7f8bd47baba63d058a6ce290/node_modules/unplugin-auto-import/dist/vite.js";
import Components from "file:///E:/demo/mcp/mcp-swagger-server/node_modules/.pnpm/unplugin-vue-components@0.2_128e49b678e37bfa6616f114b9eada0c/node_modules/unplugin-vue-components/dist/vite.mjs";
import { ElementPlusResolver } from "file:///E:/demo/mcp/mcp-swagger-server/node_modules/.pnpm/unplugin-vue-components@0.2_128e49b678e37bfa6616f114b9eada0c/node_modules/unplugin-vue-components/dist/resolvers.mjs";
var __vite_injected_original_dirname =
  "E:\\demo\\mcp\\mcp-swagger-server\\packages\\mcp-swagger-ui";
var vite_config_default = defineConfig({
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
      "@": resolve(__vite_injected_original_dirname, "src"),
    },
  },
  server: {
    port: 3e3,
    strictPort: true,
    host: true,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, "/api"),
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          "element-plus": ["element-plus"],
          monaco: ["monaco-editor"],
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
export { vite_config_default as default };
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJFOlxcXFxkZW1vXFxcXG1jcFxcXFxtY3Atc3dhZ2dlci1zZXJ2ZXJcXFxccGFja2FnZXNcXFxcbWNwLXN3YWdnZXItdWlcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkU6XFxcXGRlbW9cXFxcbWNwXFxcXG1jcC1zd2FnZ2VyLXNlcnZlclxcXFxwYWNrYWdlc1xcXFxtY3Atc3dhZ2dlci11aVxcXFx2aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vRTovZGVtby9tY3AvbWNwLXN3YWdnZXItc2VydmVyL3BhY2thZ2VzL21jcC1zd2FnZ2VyLXVpL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSBcInZpdGVcIjtcclxuaW1wb3J0IHZ1ZSBmcm9tIFwiQHZpdGVqcy9wbHVnaW4tdnVlXCI7XHJcbmltcG9ydCB7IHJlc29sdmUgfSBmcm9tIFwicGF0aFwiO1xyXG5pbXBvcnQgQXV0b0ltcG9ydCBmcm9tIFwidW5wbHVnaW4tYXV0by1pbXBvcnQvdml0ZVwiO1xyXG5pbXBvcnQgQ29tcG9uZW50cyBmcm9tIFwidW5wbHVnaW4tdnVlLWNvbXBvbmVudHMvdml0ZVwiO1xyXG5pbXBvcnQgeyBFbGVtZW50UGx1c1Jlc29sdmVyIH0gZnJvbSBcInVucGx1Z2luLXZ1ZS1jb21wb25lbnRzL3Jlc29sdmVyc1wiO1xyXG5cclxuLy8gaHR0cHM6Ly92aXRlanMuZGV2L2NvbmZpZy9cclxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcclxuICBwbHVnaW5zOiBbXHJcbiAgICB2dWUoKSxcclxuICAgIEF1dG9JbXBvcnQoe1xyXG4gICAgICByZXNvbHZlcnM6IFtFbGVtZW50UGx1c1Jlc29sdmVyKCldLFxyXG4gICAgICBpbXBvcnRzOiBbXCJ2dWVcIiwgXCJ2dWUtcm91dGVyXCIsIFwicGluaWFcIl0sXHJcbiAgICAgIGR0czogdHJ1ZSxcclxuICAgIH0pLFxyXG4gICAgQ29tcG9uZW50cyh7XHJcbiAgICAgIHJlc29sdmVyczogW0VsZW1lbnRQbHVzUmVzb2x2ZXIoKV0sXHJcbiAgICAgIGR0czogdHJ1ZSxcclxuICAgIH0pLFxyXG4gIF0sXHJcbiAgcmVzb2x2ZToge1xyXG4gICAgYWxpYXM6IHtcclxuICAgICAgXCJAXCI6IHJlc29sdmUoX19kaXJuYW1lLCBcInNyY1wiKSxcclxuICAgIH0sXHJcbiAgfSxcclxuICBzZXJ2ZXI6IHtcclxuICAgIHBvcnQ6IDMwMDAsXHJcbiAgICBzdHJpY3RQb3J0OiB0cnVlLFxyXG4gICAgaG9zdDogdHJ1ZSxcclxuICAgIHByb3h5OiB7XHJcbiAgICAgIFwiL2FwaVwiOiB7XHJcbiAgICAgICAgdGFyZ2V0OiBcImh0dHA6Ly9sb2NhbGhvc3Q6MzAwMVwiLFxyXG4gICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcclxuICAgICAgICByZXdyaXRlOiAocGF0aCkgPT4gcGF0aC5yZXBsYWNlKC9eXFwvYXBpLywgXCIvYXBpXCIpLFxyXG4gICAgICB9LFxyXG4gICAgfSxcclxuICB9LFxyXG4gIGJ1aWxkOiB7XHJcbiAgICBvdXREaXI6IFwiZGlzdFwiLFxyXG4gICAgc291cmNlbWFwOiB0cnVlLFxyXG4gICAgcm9sbHVwT3B0aW9uczoge1xyXG4gICAgICBvdXRwdXQ6IHtcclxuICAgICAgICBtYW51YWxDaHVua3M6IHtcclxuICAgICAgICAgIFwiZWxlbWVudC1wbHVzXCI6IFtcImVsZW1lbnQtcGx1c1wiXSxcclxuICAgICAgICAgIG1vbmFjbzogW1wibW9uYWNvLWVkaXRvclwiXSxcclxuICAgICAgICB9LFxyXG4gICAgICB9LFxyXG4gICAgfSxcclxuICB9LFxyXG4gIG9wdGltaXplRGVwczoge1xyXG4gICAgaW5jbHVkZTogW1wibW9uYWNvLWVkaXRvclwiXSxcclxuICB9LFxyXG4gIGRlZmluZToge1xyXG4gICAgLy8gTW9uYWNvIEVkaXRvciBcdTk3MDBcdTg5ODFcdTc2ODRcdTUxNjhcdTVDNDBcdTUzRDhcdTkxQ0ZcclxuICAgIFwicHJvY2Vzcy5lbnYuTk9ERV9FTlZcIjogSlNPTi5zdHJpbmdpZnkocHJvY2Vzcy5lbnYuTk9ERV9FTlYpLFxyXG4gIH0sXHJcbiAgd29ya2VyOiB7XHJcbiAgICBmb3JtYXQ6IFwiZXNcIixcclxuICB9LFxyXG59KTtcclxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUFnVyxTQUFTLG9CQUFvQjtBQUM3WCxPQUFPLFNBQVM7QUFDaEIsU0FBUyxlQUFlO0FBQ3hCLE9BQU8sZ0JBQWdCO0FBQ3ZCLE9BQU8sZ0JBQWdCO0FBQ3ZCLFNBQVMsMkJBQTJCO0FBTHBDLElBQU0sbUNBQW1DO0FBUXpDLElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQzFCLFNBQVM7QUFBQSxJQUNQLElBQUk7QUFBQSxJQUNKLFdBQVc7QUFBQSxNQUNULFdBQVcsQ0FBQyxvQkFBb0IsQ0FBQztBQUFBLE1BQ2pDLFNBQVMsQ0FBQyxPQUFPLGNBQWMsT0FBTztBQUFBLE1BQ3RDLEtBQUs7QUFBQSxJQUNQLENBQUM7QUFBQSxJQUNELFdBQVc7QUFBQSxNQUNULFdBQVcsQ0FBQyxvQkFBb0IsQ0FBQztBQUFBLE1BQ2pDLEtBQUs7QUFBQSxJQUNQLENBQUM7QUFBQSxFQUNIO0FBQUEsRUFDQSxTQUFTO0FBQUEsSUFDUCxPQUFPO0FBQUEsTUFDTCxLQUFLLFFBQVEsa0NBQVcsS0FBSztBQUFBLElBQy9CO0FBQUEsRUFDRjtBQUFBLEVBQ0EsUUFBUTtBQUFBLElBQ04sTUFBTTtBQUFBLElBQ04sWUFBWTtBQUFBLElBQ1osTUFBTTtBQUFBLElBQ04sT0FBTztBQUFBLE1BQ0wsUUFBUTtBQUFBLFFBQ04sUUFBUTtBQUFBLFFBQ1IsY0FBYztBQUFBLFFBQ2QsU0FBUyxDQUFDLFNBQVMsS0FBSyxRQUFRLFVBQVUsTUFBTTtBQUFBLE1BQ2xEO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFBQSxFQUNBLE9BQU87QUFBQSxJQUNMLFFBQVE7QUFBQSxJQUNSLFdBQVc7QUFBQSxJQUNYLGVBQWU7QUFBQSxNQUNiLFFBQVE7QUFBQSxRQUNOLGNBQWM7QUFBQSxVQUNaLGdCQUFnQixDQUFDLGNBQWM7QUFBQSxVQUMvQixRQUFRLENBQUMsZUFBZTtBQUFBLFFBQzFCO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQUEsRUFDQSxjQUFjO0FBQUEsSUFDWixTQUFTLENBQUMsZUFBZTtBQUFBLEVBQzNCO0FBQUEsRUFDQSxRQUFRO0FBQUE7QUFBQSxJQUVOLHdCQUF3QixLQUFLLFVBQVUsUUFBUSxJQUFJLFFBQVE7QUFBQSxFQUM3RDtBQUFBLEVBQ0EsUUFBUTtBQUFBLElBQ04sUUFBUTtBQUFBLEVBQ1Y7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
