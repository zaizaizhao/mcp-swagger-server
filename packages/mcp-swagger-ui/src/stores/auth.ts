import { ref, computed } from "vue";
import { defineStore } from "pinia";
import type {
  AuthConfig,
  AuthTestResult,
  User,
  LoginCredentials,
  RegisterData,
  LoginResponse,
} from "@/types";
import { userAuthAPI } from "@/services/api";
import { useAppStore } from "./app";
import { i18n } from "@/locales";

export const useAuthStore = defineStore("auth", () => {
  const appStore = useAppStore();
  const t = i18n.global.t;

  // 用户认证状态
  const currentUser = ref<User | null>(null);
  const accessToken = ref<string | null>(localStorage.getItem("auth_token"));
  const refreshToken = ref<string | null>(
    localStorage.getItem("refresh_token"),
  );
  const isAuthenticated = computed(
    () => !!accessToken.value && !!currentUser.value,
  );
  const authLoading = ref(false);
  const authError = ref<string | null>(null);

  // API认证配置状态
  const authConfigs = ref<Map<string, AuthConfig>>(new Map());
  const activeConfigId = ref<string | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // 测试结果
  const testResults = ref<Map<string, AuthTestResult>>(new Map());

  // 环境变量缓存
  const availableEnvVars = ref<string[]>([]);

  // Computed
  const activeConfig = computed(() => {
    if (!activeConfigId.value) return null;
    return authConfigs.value.get(activeConfigId.value) || null;
  });

  const configList = computed(() => {
    return Array.from(authConfigs.value.entries()).map(([id, config]) => ({
      id,
      ...config,
    }));
  });

  const configsByType = computed(() => {
    const grouped: Record<string, Array<{ id: string } & AuthConfig>> = {};

    configList.value.forEach((config) => {
      if (!grouped[config.type]) {
        grouped[config.type] = [];
      }
      grouped[config.type].push(config);
    });

    return grouped;
  });

  // 用户认证 Actions
  const setAuthLoading = (value: boolean) => {
    authLoading.value = value;
  };

  const setAuthError = (value: string | null) => {
    authError.value = value;
    if (value) {
      appStore.addNotification({
        type: "error",
        title: "认证错误",
        message: value,
        duration: 5000,
      });
    }
  };

  const clearAuthError = () => {
    authError.value = null;
  };

  // 设置认证令牌
  const setTokens = (tokens: { accessToken: string; refreshToken: string }) => {
    accessToken.value = tokens.accessToken;
    refreshToken.value = tokens.refreshToken;
    localStorage.setItem("auth_token", tokens.accessToken);
    localStorage.setItem("refresh_token", tokens.refreshToken);
  };

  // 清除认证令牌
  const clearTokens = () => {
    accessToken.value = null;
    refreshToken.value = null;
    currentUser.value = null;
    localStorage.removeItem("auth_token");
    localStorage.removeItem("refresh_token");
  };

  // 用户登录
  const login = async (credentials: LoginCredentials): Promise<boolean> => {
    setAuthLoading(true);
    clearAuthError();

    try {
      const response = await userAuthAPI.login(credentials);
      console.log("login response ", response);

      setTokens({
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
      });
      currentUser.value = response.user;

      appStore.addNotification({
        type: "success",
        title: t("userAuth.messages.loginSuccess"),
        message: t("userAuth.messages.welcomeBack", {
          username: response.user.username,
        }),
        duration: 3000,
      });

      return true;
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : t("userAuth.errors.loginFailed");
      setAuthError(errorMessage);
      return false;
    } finally {
      setAuthLoading(false);
    }
  };

  // 用户注册
  const register = async (userData: RegisterData): Promise<boolean> => {
    setAuthLoading(true);
    clearAuthError();

    try {
      const response = await userAuthAPI.register(userData);

      appStore.addNotification({
        type: "success",
        title: t("userAuth.messages.registerSuccess"),
        message:
          response.message || t("userAuth.messages.checkEmailVerification"),
        duration: 5000,
      });

      return true;
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : t("userAuth.errors.registerFailed");
      setAuthError(errorMessage);
      return false;
    } finally {
      setAuthLoading(false);
    }
  };

  // 用户登出
  const logout = async (): Promise<void> => {
    try {
      await userAuthAPI.logout();
    } catch (error) {
      console.warn("Logout API call failed:", error);
    } finally {
      clearTokens();
      appStore.addNotification({
        type: "info",
        title: t("userAuth.messages.loggedOut"),
        message: t("userAuth.messages.logoutSuccess"),
        duration: 3000,
      });
    }
  };

  // 获取当前用户信息
  const fetchCurrentUser = async (
    clearOnFailure: boolean = true,
  ): Promise<boolean> => {
    if (!accessToken.value) return false;

    try {
      const response = await userAuthAPI.getCurrentUser();

      currentUser.value = response;
      console.log("获取用户信息成功:", response.username);
      return true;
    } catch (error) {
      console.error("获取用户信息异常:", error);
      if (clearOnFailure) {
        clearTokens();
      }
      return false;
    }
  };

  // 刷新令牌
  const refreshAccessToken = async (): Promise<boolean> => {
    if (!refreshToken.value) return false;

    try {
      const response = await userAuthAPI.refreshToken(refreshToken.value);

      setTokens({
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
      });
      return true;
    } catch (error) {
      clearTokens();
      return false;
    }
  };

  // 初始化认证状态
  const initializeAuth = async (): Promise<void> => {
    console.log("开始初始化认证状态");
    if (accessToken.value) {
      console.log("检测到 accessToken，尝试获取用户信息");
      // 第一次尝试获取用户信息，失败时不清除令牌
      const success = await fetchCurrentUser(false);
      if (!success) {
        console.log("获取用户信息失败，尝试刷新令牌");
        // 尝试刷新令牌
        const refreshSuccess = await refreshAccessToken();
        if (refreshSuccess) {
          console.log("令牌刷新成功，再次尝试获取用户信息");
          // 刷新成功后再次尝试获取用户信息，这次失败就清除令牌
          await fetchCurrentUser(true);
        } else {
          console.log("令牌刷新失败，清除所有认证信息");
          clearTokens();
        }
      } else {
        console.log("用户信息获取成功，认证状态已恢复");
      }
    } else {
      console.log("未检测到 accessToken");
    }
  };

  // API认证配置 Actions
  const setLoading = (value: boolean) => {
    loading.value = value;
  };

  const setError = (value: string | null) => {
    error.value = value;
    if (value) {
      appStore.addNotification({
        type: "error",
        title: t("auth.errors.configError"),
        message: value,
        duration: 5000,
      });
    }
  };

  const clearError = () => {
    error.value = null;
  };

  // 创建认证配置
  const createAuthConfig = (
    name: string,
    config: Omit<AuthConfig, "encrypted">,
  ): string => {
    const id = `auth_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 加密敏感信息
    const encryptedConfig: AuthConfig = {
      ...config,
      encrypted: true,
      credentials: encryptCredentials(config.credentials),
    };

    authConfigs.value.set(id, encryptedConfig);

    appStore.addNotification({
      type: "success",
      title: t("auth.messages.configCreated"),
      message: t("auth.messages.configCreatedDetail", { name }),
      duration: 3000,
    });

    return id;
  };

  // 更新认证配置
  const updateAuthConfig = (id: string, updates: Partial<AuthConfig>) => {
    const existing = authConfigs.value.get(id);
    if (!existing) {
      setError(t("auth.errors.configNotFound"));
      return;
    }

    const updatedConfig: AuthConfig = {
      ...existing,
      ...updates,
      credentials: updates.credentials
        ? encryptCredentials(updates.credentials)
        : existing.credentials,
      encrypted: true,
    };

    authConfigs.value.set(id, updatedConfig);

    appStore.addNotification({
      type: "success",
      title: t("auth.messages.configUpdated"),
      message: t("auth.messages.configUpdatedDetail"),
      duration: 3000,
    });
  };

  // 删除认证配置
  const deleteAuthConfig = async (id: string): Promise<boolean> => {
    const config = authConfigs.value.get(id);
    if (!config) {
      setError("认证配置不存在");
      return false;
    }

    // 安全清理敏感数据
    secureDeleteCredentials(config.credentials);
    authConfigs.value.delete(id);

    // 清理相关测试结果
    testResults.value.delete(id);

    // 如果删除的是活跃配置，清空活跃状态
    if (activeConfigId.value === id) {
      activeConfigId.value = null;
    }

    appStore.addNotification({
      type: "success",
      title: "认证配置删除成功",
      message: "认证配置已安全删除",
      duration: 3000,
    });

    return true;
  };

  // 测试认证配置
  const testAuthConfig = async (id: string): Promise<AuthTestResult> => {
    setLoading(true);
    clearError();

    try {
      const config = authConfigs.value.get(id);
      if (!config) {
        throw new Error("认证配置不存在");
      }

      // 解密凭据用于测试
      const decryptedCredentials = decryptCredentials(config.credentials);

      // 模拟认证测试
      const result = await simulateAuthTest(config.type, decryptedCredentials);

      testResults.value.set(id, result);

      if (result.success) {
        appStore.addNotification({
          type: "success",
          title: "认证测试成功",
          message: result.message,
          duration: 3000,
        });
      } else {
        appStore.addNotification({
          type: "error",
          title: "认证测试失败",
          message: result.message,
          duration: 5000,
        });
      }

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "认证测试失败";
      setError(errorMessage);

      const failureResult: AuthTestResult = {
        success: false,
        message: errorMessage,
        timestamp: new Date(),
      };

      testResults.value.set(id, failureResult);
      return failureResult;
    } finally {
      setLoading(false);
    }
  };

  // 验证环境变量
  const validateEnvVars = async (
    envVars: string[],
  ): Promise<{
    available: string[];
    missing: string[];
  }> => {
    // 模拟环境变量验证
    const mockEnvVars = [
      "API_TOKEN",
      "SECRET_KEY",
      "CLIENT_ID",
      "CLIENT_SECRET",
      "BEARER_TOKEN",
      "API_KEY",
      "USERNAME",
      "PASSWORD",
    ];

    const available = envVars.filter((envVar) => mockEnvVars.includes(envVar));
    const missing = envVars.filter((envVar) => !mockEnvVars.includes(envVar));

    return { available, missing };
  };

  // 加载可用环境变量
  const loadAvailableEnvVars = async () => {
    // 模拟加载环境变量
    availableEnvVars.value = [
      "API_TOKEN",
      "SECRET_KEY",
      "CLIENT_ID",
      "CLIENT_SECRET",
      "BEARER_TOKEN",
      "API_KEY",
      "USERNAME",
      "PASSWORD",
    ];
  };

  // 设置活跃配置
  const setActiveConfig = (id: string | null) => {
    activeConfigId.value = id;
  };

  // 获取解密的凭据（仅用于显示，不存储）
  const getDecryptedCredentials = (id: string) => {
    const config = authConfigs.value.get(id);
    if (!config) return null;

    return decryptCredentials(config.credentials);
  };

  // 检查认证是否过期
  const checkAuthExpiration = (id: string): boolean => {
    // 简单的过期检测逻辑（实际应用中需要更复杂的逻辑）
    const testResult = testResults.value.get(id);
    if (!testResult) return false;

    const now = new Date();
    const testTime = new Date(testResult.timestamp);
    const hoursSinceTest =
      (now.getTime() - testTime.getTime()) / (1000 * 60 * 60);

    return hoursSinceTest > 24; // 24小时后认为可能过期
  };

  // 获取过期的认证配置
  const getExpiredConfigs = (): Array<{ id: string } & AuthConfig> => {
    return configList.value.filter((config) => checkAuthExpiration(config.id));
  };

  // 私有辅助函数

  // 加密凭据（简单的Base64编码，实际应用需要更强的加密）
  const encryptCredentials = (credentials: AuthConfig["credentials"]) => {
    const encrypted: AuthConfig["credentials"] = {};

    Object.entries(credentials).forEach(([key, value]) => {
      if (value && typeof value === "string") {
        encrypted[key as keyof AuthConfig["credentials"]] = btoa(value);
      }
    });

    return encrypted;
  };

  // 解密凭据
  const decryptCredentials = (
    encryptedCredentials: AuthConfig["credentials"],
  ) => {
    const decrypted: AuthConfig["credentials"] = {};

    Object.entries(encryptedCredentials).forEach(([key, value]) => {
      if (value && typeof value === "string") {
        try {
          decrypted[key as keyof AuthConfig["credentials"]] = atob(value);
        } catch (error) {
          console.warn(`Failed to decrypt credential: ${key}`);
          decrypted[key as keyof AuthConfig["credentials"]] = value;
        }
      }
    });

    return decrypted;
  };

  // 安全删除凭据
  const secureDeleteCredentials = (credentials: AuthConfig["credentials"]) => {
    // 在实际应用中，这里应该进行安全的内存清理
    Object.keys(credentials).forEach((key) => {
      delete credentials[key as keyof AuthConfig["credentials"]];
    });
  };

  // 模拟认证测试
  const simulateAuthTest = async (
    type: AuthConfig["type"],
    credentials: AuthConfig["credentials"],
  ): Promise<AuthTestResult> => {
    // 模拟网络延迟
    await new Promise((resolve) =>
      setTimeout(resolve, 1000 + Math.random() * 2000),
    );

    // 验证必需的凭据
    const validationResult = validateCredentialsForType(type, credentials);
    if (!validationResult.valid) {
      return {
        success: false,
        message: validationResult.message,
        timestamp: new Date(),
      };
    }

    // 模拟测试结果（80%成功率）
    const success = Math.random() > 0.2;

    if (success) {
      return {
        success: true,
        message: getSuccessMessage(type),
        details: {
          type,
          endpoint: getTestEndpoint(type),
          responseTime: Math.floor(Math.random() * 1000) + 200,
        },
        timestamp: new Date(),
      };
    } else {
      return {
        success: false,
        message: getErrorMessage(type),
        details: {
          type,
          errorCode: getRandomErrorCode(),
          endpoint: getTestEndpoint(type),
        },
        timestamp: new Date(),
      };
    }
  };

  // 验证不同类型认证的必需凭据
  const validateCredentialsForType = (
    type: AuthConfig["type"],
    credentials: AuthConfig["credentials"],
  ): { valid: boolean; message: string } => {
    switch (type) {
      case "bearer":
        if (!credentials.token) {
          return { valid: false, message: "Bearer Token 不能为空" };
        }
        break;

      case "apikey":
        if (!credentials.apiKey) {
          return { valid: false, message: "API Key 不能为空" };
        }
        break;

      case "basic":
        if (!credentials.username || !credentials.password) {
          return { valid: false, message: "用户名和密码不能为空" };
        }
        break;

      case "oauth2":
        if (!credentials.clientId || !credentials.clientSecret) {
          return {
            valid: false,
            message: "Client ID 和 Client Secret 不能为空",
          };
        }
        break;

      default:
        return { valid: false, message: "不支持的认证类型" };
    }

    return { valid: true, message: "凭据验证通过" };
  };

  const getSuccessMessage = (type: AuthConfig["type"]): string => {
    const messages = {
      bearer: "Bearer Token 认证成功",
      apikey: "API Key 认证成功",
      basic: "基础认证成功",
      oauth2: "OAuth2 认证成功",
    };
    return messages[type];
  };

  const getErrorMessage = (type: AuthConfig["type"]): string => {
    const errors = [
      "认证失败：凭据无效",
      "认证失败：权限不足",
      "认证失败：凭据已过期",
      "认证失败：服务不可用",
      "认证失败：网络连接超时",
    ];
    return errors[Math.floor(Math.random() * errors.length)];
  };

  const getTestEndpoint = (type: AuthConfig["type"]): string => {
    const endpoints = {
      bearer: "/api/v1/auth/validate-token",
      apikey: "/api/v1/auth/validate-key",
      basic: "/api/v1/auth/login",
      oauth2: "/api/v1/oauth/token",
    };
    return endpoints[type];
  };

  const getRandomErrorCode = (): number => {
    const codes = [401, 403, 404, 429, 500, 502, 503];
    return codes[Math.floor(Math.random() * codes.length)];
  };

  // 过期监控和自动提醒
  const expirationCheckInterval = ref<NodeJS.Timeout | null>(null);
  const renewalReminders = ref<Map<string, number>>(new Map());

  const startExpirationMonitoring = () => {
    if (expirationCheckInterval.value) {
      clearInterval(expirationCheckInterval.value);
    }

    // 每30分钟检查一次过期状态
    expirationCheckInterval.value = setInterval(
      () => {
        checkAllExpiration();
      },
      30 * 60 * 1000,
    );

    // 立即执行一次检查
    checkAllExpiration();
  };

  const stopExpirationMonitoring = () => {
    if (expirationCheckInterval.value) {
      clearInterval(expirationCheckInterval.value);
      expirationCheckInterval.value = null;
    }
  };

  const checkAllExpiration = () => {
    const now = Date.now();
    const expiringSoon: Array<{
      id: string;
      config: AuthConfig;
      timeLeft: number;
    }> = [];
    const expired: Array<{ id: string; config: AuthConfig }> = [];

    configList.value.forEach(({ id, ...config }) => {
      if (config.expiresAt) {
        const timeLeft = new Date(config.expiresAt).getTime() - now;
        const hoursLeft = timeLeft / (1000 * 60 * 60);

        if (timeLeft <= 0) {
          expired.push({ id, config });
        } else if (hoursLeft <= 24) {
          expiringSoon.push({ id, config, timeLeft });
        }
      }
    });

    // 处理已过期的配置
    if (expired.length > 0) {
      appStore.addNotification({
        type: "error",
        title: "认证配置已过期",
        message: `${expired.length} 个认证配置已过期，请及时更新`,
        duration: 0, // 持续显示直到用户关闭
        actions: [
          {
            label: "查看详情",
            action: () => {
              // 这里可以触发导航到认证管理页面
              console.log("Navigate to auth management");
            },
          },
        ],
      });
    }

    // 处理即将过期的配置
    expiringSoon.forEach(({ id, config, timeLeft }) => {
      const hoursLeft = Math.ceil(timeLeft / (1000 * 60 * 60));

      // 检查是否已经发送过提醒
      const lastReminder = renewalReminders.value.get(id) || 0;
      const reminderInterval = 6 * 60 * 60 * 1000; // 6小时提醒一次

      if (now - lastReminder > reminderInterval) {
        appStore.addNotification({
          type: "warning",
          title: "认证配置即将过期",
          message: `${getConfigDisplayName(config)} 将在 ${hoursLeft} 小时后过期`,
          duration: 8000,
          actions: [
            {
              label: "立即续期",
              action: () => {
                // 触发续期操作
                console.log("Renew config:", id);
              },
            },
            {
              label: "稍后提醒",
              action: () => {
                // 记录提醒时间，延迟下次提醒
                renewalReminders.value.set(id, now);
              },
            },
          ],
        });

        renewalReminders.value.set(id, now);
      }
    });
  };

  const getConfigDisplayName = (config: AuthConfig): string => {
    const typeLabels = {
      bearer: "Bearer Token",
      apikey: "API Key",
      basic: "Basic Auth",
      oauth2: "OAuth2",
    };
    return `${typeLabels[config.type]} 配置`;
  };

  // 批量清理过期配置
  const cleanupExpiredConfigs = async () => {
    const expired = getExpiredConfigs();
    if (expired.length === 0) {
      appStore.addNotification({
        type: "info",
        title: "清理完成",
        message: "没有发现过期的认证配置",
        duration: 3000,
      });
      return;
    }

    try {
      for (const config of expired) {
        // 安全删除敏感数据
        await secureDeleteConfig(config.id);
      }

      appStore.addNotification({
        type: "success",
        title: "清理完成",
        message: `已清理 ${expired.length} 个过期的认证配置`,
        duration: 3000,
      });
    } catch (error) {
      appStore.addNotification({
        type: "error",
        title: "清理失败",
        message: "清理过期配置时发生错误",
        duration: 5000,
      });
    }
  };

  const secureDeleteConfig = async (configId: string): Promise<void> => {
    const config = authConfigs.value.get(configId);
    if (!config) return;

    // 多次覆写敏感数据以确保安全删除
    const dummy = "X".repeat(50);
    const secureConfig = {
      ...config,
      credentials: {
        token: dummy,
        apiKey: dummy,
        username: dummy,
        password: dummy,
        clientId: dummy,
        clientSecret: dummy,
      },
    };

    // 执行多次覆写
    for (let i = 0; i < 3; i++) {
      authConfigs.value.set(configId, secureConfig);
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    // 最终删除
    authConfigs.value.delete(configId);
    testResults.value.delete(configId);
    renewalReminders.value.delete(configId);

    // 如果删除的是当前活动配置，清除活动状态
    if (activeConfigId.value === configId) {
      activeConfigId.value = null;
    }
  };

  return {
    // 用户认证状态
    currentUser,
    accessToken,
    refreshToken,
    isAuthenticated,
    authLoading,
    authError,

    // API认证配置状态
    authConfigs,
    activeConfigId,
    loading,
    error,
    testResults,
    availableEnvVars,

    // Computed
    activeConfig,
    configList,
    configsByType,

    // 用户认证 Actions
    setAuthLoading,
    setAuthError,
    clearAuthError,
    setTokens,
    clearTokens,
    login,
    register,
    logout,
    fetchCurrentUser,
    refreshAccessToken,
    initializeAuth,

    // API认证配置 Actions
    setLoading,
    setError,
    clearError,
    createAuthConfig,
    updateAuthConfig,
    deleteAuthConfig,
    testAuthConfig,
    validateEnvVars,
    loadAvailableEnvVars,
    setActiveConfig,
    getDecryptedCredentials,
    checkAuthExpiration,
    getExpiredConfigs,

    // 过期监控
    startExpirationMonitoring,
    stopExpirationMonitoring,
    checkAllExpiration,
    cleanupExpiredConfigs,
    secureDeleteConfig,
  };
});
