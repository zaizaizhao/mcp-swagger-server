import { ref, App } from "vue";
import { ElMessageBox, ElMessage } from "element-plus";

export interface ConfirmationOptions {
  type?: "confirm" | "warning" | "danger" | "info" | "success";
  title?: string;
  message: string;
  details?: string;
  confirmText?: string;
  cancelText?: string;
  showCancel?: boolean;
  dangerous?: boolean;
  dangerTitle?: string;
  dangerDescription?: string;
  requireConfirmation?: boolean;
  confirmationText?: string;
  confirmationHint?: string;
  countdown?: number;
  autoAction?: "confirm" | "cancel";
  onConfirm?: () => void;
  onCancel?: () => void;
}

export interface QuickConfirmationOptions {
  title?: string;
  message: string;
  type?: "warning" | "danger" | "info";
}

/**
 * 操作确认组合函数
 * 提供各种类型的确认对话框功能
 */
export function useConfirmation() {
  const isVisible = ref(false);
  const currentOptions = ref<ConfirmationOptions | null>(null);

  /**
   * 显示自定义确认对话框
   */
  const showConfirmation = (options: ConfirmationOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      currentOptions.value = options;
      isVisible.value = true;

      const handleConfirm = () => {
        isVisible.value = false;
        resolve(true);
      };

      const handleCancel = () => {
        isVisible.value = false;
        resolve(false);
      };

      // 绑定事件处理器
      currentOptions.value.onConfirm = handleConfirm;
      currentOptions.value.onCancel = handleCancel;
    });
  };

  /**
   * 显示危险操作确认对话框
   */
  const confirmDangerousAction = (
    message: string,
    options: Partial<ConfirmationOptions> = {},
  ): Promise<boolean> => {
    console.log('🛑 [FRONTEND DEBUG] confirmDangerousAction called with message:', message);
    
    return ElMessageBox.confirm(
      message,
      options.title || "危险操作确认",
      {
        confirmButtonText: options.confirmText || "确定",
        cancelButtonText: options.cancelText || "取消",
        type: "warning",
        center: true,
        dangerouslyUseHTMLString: false,
      }
    )
      .then(() => {
        console.log('🛑 [FRONTEND DEBUG] User confirmed dangerous action');
        return true;
      })
      .catch(() => {
        console.log('🛑 [FRONTEND DEBUG] User cancelled dangerous action');
        return false;
      });
  };

  /**
   * 显示删除确认对话框
   */
  const confirmDelete = (
    itemName: string,
    options: Partial<ConfirmationOptions> = {},
  ): Promise<boolean> => {
    return confirmDangerousAction(
      `确定要删除 "${itemName}" 吗？此操作不可撤销。`,
      {
        title: "确认删除",
        requireConfirmation: true,
        confirmationText: "DELETE",
        confirmationHint: '请输入 "DELETE" 以确认删除操作：',
        ...options,
      },
    );
  };

  /**
   * 显示批量删除确认对话框
   */
  const confirmBatchDelete = (
    count: number,
    options: Partial<ConfirmationOptions> = {},
  ): Promise<boolean> => {
    return confirmDangerousAction(
      `确定要删除选中的 ${count} 个项目吗？此操作不可撤销。`,
      {
        title: "批量删除确认",
        requireConfirmation: true,
        confirmationText: "DELETE ALL",
        confirmationHint: '请输入 "DELETE ALL" 以确认批量删除操作：',
        ...options,
      },
    );
  };

  /**
   * 显示保存确认对话框
   */
  const confirmSave = (
    message: string = "是否保存当前更改？",
    options: Partial<ConfirmationOptions> = {},
  ): Promise<boolean> => {
    return showConfirmation({
      type: "confirm",
      title: "保存确认",
      message,
      confirmText: "保存",
      cancelText: "不保存",
      ...options,
    });
  };

  /**
   * 显示离开确认对话框
   */
  const confirmLeave = (
    message: string = "您有未保存的更改，确定要离开吗？",
    options: Partial<ConfirmationOptions> = {},
  ): Promise<boolean> => {
    return showConfirmation({
      type: "warning",
      title: "离开确认",
      message,
      confirmText: "离开",
      cancelText: "继续编辑",
      ...options,
    });
  };

  /**
   * 显示重置确认对话框
   */
  const confirmReset = (
    message: string = "确定要重置所有设置吗？此操作将清除所有自定义配置。",
    options: Partial<ConfirmationOptions> = {},
  ): Promise<boolean> => {
    return showConfirmation({
      type: "warning",
      title: "重置确认",
      message,
      confirmText: "重置",
      cancelText: "取消",
      ...options,
    });
  };

  /**
   * 显示发布确认对话框
   */
  const confirmPublish = (
    message: string = "确定要发布当前版本吗？发布后将立即生效。",
    options: Partial<ConfirmationOptions> = {},
  ): Promise<boolean> => {
    return showConfirmation({
      type: "success",
      title: "发布确认",
      message,
      confirmText: "发布",
      cancelText: "取消",
      countdown: 10,
      autoAction: "cancel",
      ...options,
    });
  };

  /**
   * 显示快速确认对话框（使用ElementPlus内置）
   */
  const quickConfirm = (
    options: QuickConfirmationOptions,
  ): Promise<boolean> => {
    const messageType =
      options.type === "danger" ? "warning" : options.type || "warning";

    return ElMessageBox.confirm(options.message, options.title || "确认", {
      confirmButtonText: "确定",
      cancelButtonText: "取消",
      type: messageType,
      center: true,
    })
      .then(() => true)
      .catch(() => false);
  };

  /**
   * 显示简单提示确认
   */
  const simpleConfirm = (message: string): Promise<boolean> => {
    return quickConfirm({ message });
  };

  /**
   * 显示警告确认
   */
  const warningConfirm = (
    message: string,
    title?: string,
  ): Promise<boolean> => {
    return quickConfirm({
      message,
      title: title || "警告",
      type: "warning",
    });
  };

  /**
   * 显示危险确认
   */
  const dangerConfirm = (message: string, title?: string): Promise<boolean> => {
    return quickConfirm({
      message,
      title: title || "危险操作",
      type: "warning",
    });
  };

  /**
   * 显示信息确认
   */
  const infoConfirm = (message: string, title?: string): Promise<boolean> => {
    return quickConfirm({
      message,
      title: title || "信息",
      type: "info",
    });
  };

  return {
    isVisible,
    currentOptions,

    // 基础方法
    showConfirmation,
    quickConfirm,

    // 特定场景方法
    confirmDangerousAction,
    confirmDelete,
    confirmBatchDelete,
    confirmSave,
    confirmLeave,
    confirmReset,
    confirmPublish,

    // 简化方法
    simpleConfirm,
    warningConfirm,
    dangerConfirm,
    infoConfirm,
  };
}

/**
 * 全局确认对话框实例
 * 可在整个应用中使用
 */
let globalConfirmation: ReturnType<typeof useConfirmation> | null = null;

export function createGlobalConfirmation() {
  if (!globalConfirmation) {
    globalConfirmation = useConfirmation();
  }
  return globalConfirmation;
}

export function getGlobalConfirmation() {
  if (!globalConfirmation) {
    throw new Error(
      "Global confirmation not initialized. Call createGlobalConfirmation() first.",
    );
  }
  return globalConfirmation;
}

/**
 * 全局确认对话框插件
 */
export const ConfirmationPlugin = {
  install(app: App) {
    const confirmation = createGlobalConfirmation();

    app.config.globalProperties.$confirm = confirmation;
    app.provide("confirmation", confirmation);
  },
};

// 类型扩展
declare module "vue" {
  interface ComponentCustomProperties {
    $confirm: ReturnType<typeof useConfirmation>;
  }
}

/**
 * 装饰器：自动确认危险操作
 */
export function confirmDangerous(
  message?: string,
  options?: Partial<ConfirmationOptions>,
) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const confirmation = getGlobalConfirmation();
      const confirmed = await confirmation.confirmDangerousAction(
        message || `确定要执行 ${propertyKey} 操作吗？`,
        options,
      );

      if (confirmed) {
        return originalMethod.apply(this, args);
      }
    };

    return descriptor;
  };
}

/**
 * 装饰器：自动确认删除操作
 */
export function confirmDelete(
  getItemName?: (args: any[]) => string,
  options?: Partial<ConfirmationOptions>,
) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const confirmation = getGlobalConfirmation();
      const itemName = getItemName ? getItemName(args) : "该项目";
      const confirmed = await confirmation.confirmDelete(itemName, options);

      if (confirmed) {
        return originalMethod.apply(this, args);
      }
    };

    return descriptor;
  };
}

/**
 * 实用工具函数
 */
export const ConfirmationUtils = {
  /**
   * 检查是否需要确认
   */
  needsConfirmation(actionType: string): boolean {
    const dangerousActions = [
      "delete",
      "remove",
      "clear",
      "reset",
      "truncate",
      "drop",
      "destroy",
      "purge",
    ];
    return dangerousActions.some((action) =>
      actionType.toLowerCase().includes(action),
    );
  },

  /**
   * 获取操作类型对应的确认配置
   */
  getConfirmationConfig(actionType: string): Partial<ConfirmationOptions> {
    const configs: Record<string, Partial<ConfirmationOptions>> = {
      delete: { type: "danger", dangerous: true },
      remove: { type: "danger", dangerous: true },
      clear: { type: "warning" },
      reset: { type: "warning" },
      save: { type: "confirm" },
      publish: { type: "success", countdown: 10 },
      leave: { type: "warning" },
    };

    for (const [key, config] of Object.entries(configs)) {
      if (actionType.toLowerCase().includes(key)) {
        return config;
      }
    }

    return { type: "confirm" };
  },

  /**
   * 批量确认处理
   */
  async batchConfirm(
    items: any[],
    getMessage: (item: any) => string,
    options?: Partial<ConfirmationOptions>,
  ): Promise<boolean[]> {
    const confirmation = getGlobalConfirmation();
    const results: boolean[] = [];

    for (const item of items) {
      const message = getMessage(item);
      const confirmed = await confirmation.showConfirmation({
        message,
        ...options,
      });
      results.push(confirmed);

      if (!confirmed) break; // 如果用户取消，停止后续确认
    }

    return results;
  },
};
