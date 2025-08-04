import { ElMessage, ElNotification } from "element-plus";

// 通知类型
type NotificationType = "success" | "warning" | "info" | "error";

// 消息选项
interface MessageOptions {
  message: string;
  type?: NotificationType;
  duration?: number;
  showClose?: boolean;
}

// 通知选项
interface NotifyOptions {
  title: string;
  message: string;
  type?: NotificationType;
  duration?: number;
}

export const useNotification = () => {
  // 显示消息
  const showMessage = (options: MessageOptions | string) => {
    if (typeof options === "string") {
      ElMessage({
        message: options,
        type: "info",
        duration: 3000,
      });
    } else {
      ElMessage({
        duration: 3000,
        showClose: true,
        ...options,
      });
    }
  };

  // 显示成功消息
  const showSuccess = (message: string, duration = 3000) => {
    ElMessage.success({
      message,
      duration,
      showClose: true,
    });
  };

  // 显示错误消息
  const showError = (message: string, duration = 5000) => {
    ElMessage.error({
      message,
      duration,
      showClose: true,
    });
  };

  // 显示警告消息
  const showWarning = (message: string, duration = 4000) => {
    ElMessage.warning({
      message,
      duration,
      showClose: true,
    });
  };

  // 显示信息消息
  const showInfo = (message: string, duration = 3000) => {
    ElMessage.info({
      message,
      duration,
      showClose: true,
    });
  };

  // 显示通知
  const showNotification = (options: NotifyOptions) => {
    ElNotification({
      duration: 4500,
      ...options,
    });
  };

  // 显示成功通知
  const notifySuccess = (title: string, message: string) => {
    ElNotification.success({
      title,
      message,
      duration: 4500,
    });
  };

  // 显示错误通知
  const notifyError = (title: string, message: string) => {
    ElNotification.error({
      title,
      message,
      duration: 6000,
    });
  };

  // 显示警告通知
  const notifyWarning = (title: string, message: string) => {
    ElNotification.warning({
      title,
      message,
      duration: 5000,
    });
  };

  // 显示信息通知
  const notifyInfo = (title: string, message: string) => {
    ElNotification.info({
      title,
      message,
      duration: 4500,
    });
  };

  return {
    // 消息方法
    showMessage,
    showSuccess,
    showError,
    showWarning,
    showInfo,

    // 通知方法
    showNotification,
    notifySuccess,
    notifyError,
    notifyWarning,
    notifyInfo,
  };
};
