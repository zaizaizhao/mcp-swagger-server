import { createApp } from "vue";
import { ElMessage, ElMessageBox, ElNotification } from "element-plus";

// 错误类型定义
export interface AppError {
  code: string;
  message: string;
  details?: any;
  timestamp: Date;
  source?: string;
  stack?: string;
}

// 错误级别
export enum ErrorLevel {
  INFO = "info",
  WARNING = "warning",
  ERROR = "error",
  CRITICAL = "critical",
}

// 通知类型
export interface NotificationOptions {
  title: string;
  message: string;
  type?: "success" | "warning" | "info" | "error";
  duration?: number;
  showClose?: boolean;
  dangerouslyUseHTMLString?: boolean;
  position?: "top-right" | "top-left" | "bottom-right" | "bottom-left";
  onClose?: () => void;
}

// 全局错误处理器类
class GlobalErrorHandler {
  private errorHistory: AppError[] = [];
  private maxHistorySize = 100;
  private listeners: ((error: AppError) => void)[] = [];

  // 注册全局错误处理
  install(app: any) {
    // Vue错误处理
    app.config.errorHandler = (error: any, instance: any, info: string) => {
      this.handleVueError(error, instance, info);
    };

    // 全局未捕获的Promise错误
    window.addEventListener("unhandledrejection", (event) => {
      this.handlePromiseRejection(event);
    });

    // 全局JavaScript错误
    window.addEventListener("error", (event) => {
      this.handleJavaScriptError(event);
    });

    // 资源加载错误
    window.addEventListener(
      "error",
      (event) => {
        if (event.target !== window) {
          this.handleResourceError(event);
        }
      },
      true,
    );
  }

  // 处理Vue组件错误
  private handleVueError(error: any, instance: any, info: string) {
    const appError: AppError = {
      code: "VUE_ERROR",
      message: error.message || "未知Vue错误",
      details: {
        componentInfo: info,
        errorStack: error.stack,
        componentInstance: instance?.$options?.name || "Unknown",
      },
      timestamp: new Date(),
      source: "Vue Component",
      stack: error.stack,
    };

    this.logError(appError);
    this.showErrorNotification(appError);
  }

  // 处理Promise拒绝错误
  private handlePromiseRejection(event: PromiseRejectionEvent) {
    const appError: AppError = {
      code: "PROMISE_REJECTION",
      message: event.reason?.message || "未知Promise错误",
      details: {
        reason: event.reason,
        promise: event.promise,
      },
      timestamp: new Date(),
      source: "Promise",
      stack: event.reason?.stack,
    };

    this.logError(appError);
    this.showErrorNotification(appError);

    // 阻止浏览器默认的未处理Promise警告
    event.preventDefault();
  }

  // 处理JavaScript错误
  private handleJavaScriptError(event: ErrorEvent) {
    const appError: AppError = {
      code: "JAVASCRIPT_ERROR",
      message: event.message || "未知JavaScript错误",
      details: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      },
      timestamp: new Date(),
      source: "JavaScript",
      stack: event.error?.stack,
    };

    this.logError(appError);
    this.showErrorNotification(appError);
  }

  // 处理资源加载错误
  private handleResourceError(event: Event) {
    const target = event.target as HTMLElement;
    const appError: AppError = {
      code: "RESOURCE_ERROR",
      message: `资源加载失败: ${target.tagName}`,
      details: {
        tagName: target.tagName,
        src: (target as any).src || (target as any).href,
        type: event.type,
      },
      timestamp: new Date(),
      source: "Resource Loading",
    };

    this.logError(appError);
    // 资源错误通常不需要用户通知，只记录日志
    console.warn("Resource loading error:", appError);
  }

  // 手动报告错误
  reportError(error: any, context?: string) {
    const appError: AppError = {
      code: "MANUAL_ERROR",
      message: error.message || error.toString(),
      details: {
        context,
        originalError: error,
      },
      timestamp: new Date(),
      source: context || "Manual Report",
      stack: error.stack,
    };

    this.logError(appError);
    this.showErrorNotification(appError);
  }

  // 显示API错误
  showApiError(error: any, context?: string) {
    let message = "操作失败";
    let details = error;

    if (error.response) {
      // HTTP错误响应
      const status = error.response.status;
      message = this.getHttpErrorMessage(status);
      details = {
        status,
        statusText: error.response.statusText,
        data: error.response.data,
        url: error.config?.url,
      };
    } else if (error.request) {
      // 网络错误
      message = "网络连接失败，请检查网络设置";
      details = {
        request: error.request,
        url: error.config?.url,
      };
    } else {
      // 其他错误
      message = error.message || "未知错误";
    }

    const appError: AppError = {
      code: "API_ERROR",
      message,
      details,
      timestamp: new Date(),
      source: context || "API Request",
      stack: error.stack,
    };

    this.logError(appError);
    this.showErrorNotification(appError);
  }

  // 获取HTTP错误消息
  private getHttpErrorMessage(status: number): string {
    const messages: Record<number, string> = {
      400: "请求参数错误",
      401: "未授权访问，请重新登录",
      403: "访问被拒绝，权限不足",
      404: "请求的资源不存在",
      408: "请求超时，请重试",
      409: "请求冲突，请检查数据",
      422: "请求数据格式错误",
      429: "请求过于频繁，请稍后重试",
      500: "服务器内部错误",
      502: "网关错误",
      503: "服务暂不可用",
      504: "网关超时",
    };

    return messages[status] || `请求失败 (${status})`;
  }

  // 记录错误到历史
  private logError(error: AppError) {
    this.errorHistory.unshift(error);

    // 限制历史记录大小
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory = this.errorHistory.slice(0, this.maxHistorySize);
    }

    // 通知监听器
    this.listeners.forEach((listener) => {
      try {
        listener(error);
      } catch (err) {
        console.error("Error in error listener:", err);
      }
    });

    // 控制台输出
    console.error("Application Error:", error);
  }

  // 显示错误通知
  private showErrorNotification(error: AppError) {
    // 根据错误类型决定通知方式
    if (error.code === "RESOURCE_ERROR") {
      return; // 资源错误不显示用户通知
    }

    const isApiError = error.code === "API_ERROR";
    const isCritical =
      error.code === "VUE_ERROR" || error.code === "JAVASCRIPT_ERROR";

    if (isCritical) {
      // 严重错误使用对话框
      ElMessageBox.alert(error.message, "系统错误", {
        type: "error",
        confirmButtonText: "确定",
        callback: () => {
          // 可以在这里添加错误报告功能
        },
      });
    } else if (isApiError) {
      // API错误使用消息提示
      ElMessage({
        type: "error",
        message: error.message,
        duration: 5000,
        showClose: true,
      });
    } else {
      // 其他错误使用通知
      ElNotification({
        type: "error",
        title: "系统提示",
        message: error.message,
        duration: 5000,
        position: "top-right",
      });
    }
  }

  // 添加错误监听器
  addErrorListener(listener: (error: AppError) => void) {
    this.listeners.push(listener);
  }

  // 移除错误监听器
  removeErrorListener(listener: (error: AppError) => void) {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  // 获取错误历史
  getErrorHistory(): AppError[] {
    return [...this.errorHistory];
  }

  // 清空错误历史
  clearErrorHistory() {
    this.errorHistory = [];
  }

  // 获取错误统计
  getErrorStats() {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const lastHour = new Date(now.getTime() - 60 * 60 * 1000);

    const errors24h = this.errorHistory.filter(
      (error) => error.timestamp >= last24h,
    );
    const errorsLastHour = this.errorHistory.filter(
      (error) => error.timestamp >= lastHour,
    );

    const errorsByCode = this.errorHistory.reduce(
      (acc, error) => {
        acc[error.code] = (acc[error.code] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      total: this.errorHistory.length,
      last24h: errors24h.length,
      lastHour: errorsLastHour.length,
      byCode: errorsByCode,
      latestError: this.errorHistory[0] || null,
    };
  }
}

// 全局通知管理器类
class GlobalNotificationManager {
  private notificationQueue: NotificationOptions[] = [];
  private maxConcurrent = 3;
  private activeScount = 0;

  // 显示成功通知
  success(options: string | NotificationOptions) {
    const config = this.normalizeOptions(options, "success");
    this.showNotification(config);
  }

  // 显示警告通知
  warning(options: string | NotificationOptions) {
    const config = this.normalizeOptions(options, "warning");
    this.showNotification(config);
  }

  // 显示信息通知
  info(options: string | NotificationOptions) {
    const config = this.normalizeOptions(options, "info");
    this.showNotification(config);
  }

  // 显示错误通知
  error(options: string | NotificationOptions) {
    const config = this.normalizeOptions(options, "error");
    this.showNotification(config);
  }

  // 显示操作成功消息
  operationSuccess(operation: string, details?: string) {
    const message = details ? `${operation}: ${details}` : operation;
    ElMessage({
      type: "success",
      message: `${message} 成功`,
      duration: 3000,
      showClose: true,
    });
  }

  // 显示操作失败消息
  operationError(operation: string, error?: string) {
    const message = error ? `${operation}: ${error}` : operation;
    ElMessage({
      type: "error",
      message: `${message} 失败`,
      duration: 5000,
      showClose: true,
    });
  }

  // 显示加载消息
  loading(message: string = "加载中...") {
    return ElMessage({
      type: "info",
      message,
      duration: 0,
      showClose: false,
    });
  }

  // 规范化通知选项
  private normalizeOptions(
    options: string | NotificationOptions,
    defaultType: "success" | "warning" | "info" | "error",
  ): NotificationOptions {
    if (typeof options === "string") {
      return {
        title: defaultType === "error" ? "错误" : "提示",
        message: options,
        type: defaultType,
        duration: defaultType === "error" ? 5000 : 3000,
        position: "top-right",
      };
    }

    return {
      type: defaultType,
      duration: defaultType === "error" ? 5000 : 3000,
      position: "top-right",
      ...options,
    };
  }

  // 显示通知
  private showNotification(options: NotificationOptions) {
    if (this.activeScount >= this.maxConcurrent) {
      this.notificationQueue.push(options);
      return;
    }

    this.activeScount++;

    const originalOnClose = options.onClose;
    options.onClose = () => {
      this.activeScount--;
      originalOnClose?.();
      this.processQueue();
    };

    ElNotification(options);
  }

  // 处理队列中的通知
  private processQueue() {
    if (
      this.notificationQueue.length > 0 &&
      this.activeScount < this.maxConcurrent
    ) {
      const nextNotification = this.notificationQueue.shift();
      if (nextNotification) {
        this.showNotification(nextNotification);
      }
    }
  }

  // 清除所有通知
  clearAll() {
    this.notificationQueue = [];
    // Element Plus没有直接清除所有通知的API，只能等待自动消失
  }
}

// 创建全局实例
export const globalErrorHandler = new GlobalErrorHandler();
export const globalNotification = new GlobalNotificationManager();

// 便捷的错误处理函数
export const handleError = (error: any, context?: string) => {
  globalErrorHandler.reportError(error, context);
};

// 便捷的API错误处理函数
export const handleApiError = (error: any, context?: string) => {
  globalErrorHandler.showApiError(error, context);
};

// 便捷的通知函数
export const notify = globalNotification;

// Vue插件安装函数
export default {
  install(app: any) {
    globalErrorHandler.install(app);

    // 将错误处理器和通知管理器添加到全局属性
    app.config.globalProperties.$errorHandler = globalErrorHandler;
    app.config.globalProperties.$notify = globalNotification;
    app.config.globalProperties.$handleError = handleError;
    app.config.globalProperties.$handleApiError = handleApiError;
  },
};
