import { createApp } from "vue";
import ElementPlus from "element-plus";
import "element-plus/dist/index.css";
import App from "./App.vue";
import router from "./router";
import { createPinia } from "pinia";

// 导入全局功能
import { globalErrorHandler } from "./utils/errorHandler";
import { ConfirmationPlugin } from "./composables/useConfirmation";

const app = createApp(App);

// 注册Pinia
app.use(createPinia());

// 注册路由
app.use(router);

// 注册Element Plus
app.use(ElementPlus);

// 注册全局错误处理
app.use(globalErrorHandler);

// 注册全局确认对话框
app.use(ConfirmationPlugin);

app.mount("#app");

// 示例：在全局中使用这些功能
export { app };
