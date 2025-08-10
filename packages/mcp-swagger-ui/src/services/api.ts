import axios, { type AxiosInstance, type AxiosResponse } from "axios";
import type {
  ApiResponse,
  MCPServer,
  ServerConfig,
  OpenAPISpec,
  MCPTool,
  TestCase,
  ToolResult,
  AuthConfig,
  AuthTestResult,
  SystemMetrics,
  LogEntry,
  LogFilter,
  ConfigFile,
  ExportOptions,
  ImportResult,
  AIAssistantType,
  ConfigTemplate,
  ConfigOptions,
  ValidationResult,
} from "@/types";
import {
  normalizeAPIError,
  logAPIError,
  createRetryFunction,
  type APIError,
} from "@/utils/apiError";

// 创建axios实例
const api: AxiosInstance = axios.create({
  baseURL: "/api", // 使用相对路径，通过 Vite 代理转发到后端
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    // 添加认证token
    const token = localStorage.getItem("auth_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // 移除了 API Key 认证，统一使用 JWT

    // 添加请求ID用于追踪
    config.headers["X-Request-ID"] =
      `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    // 添加时间戳
    (config as any).metadata = { startTime: Date.now() };

    return config;
  },
  (error) => {
    console.error("Request interceptor error:", error);
    return Promise.reject(error);
  },
);

// 响应拦截器
api.interceptors.response.use(
  (response: AxiosResponse<any>): any => {
    // 计算请求耗时
    const endTime = Date.now();
    const startTime = (response.config as any).metadata?.startTime || endTime;
    const duration = endTime - startTime;

    // 记录慢请求
    if (duration > 3000) {
      console.warn(
        `Slow API request detected: ${response.config.url} took ${duration}ms`,
      );
    }

    // 添加响应元数据
    if (response.data && typeof response.data === "object") {
      response.data._metadata = {
        requestId: response.config.headers["X-Request-ID"],
        duration,
        timestamp: new Date().toISOString(),
        success: true,
      };
    }
    // 返回 response.data 而不是完整的 response 对象
    return response;
  },
  (error) => {
    // 统一错误处理
    console.error("API Error:", error);

    // 计算请求耗时（即使失败）
    const endTime = Date.now();
    const startTime = (error.config as any)?.metadata?.startTime || endTime;
    const duration = endTime - startTime;

    // 处理不同类型的错误
    let errorMessage = "请求失败";
    let errorCode = "UNKNOWN_ERROR";

    if (error.response) {
      // 服务器响应错误
      const status = error.response.status;
      const data = error.response.data;

      switch (status) {
        case 400:
          errorMessage = data?.message || "请求参数错误";
          errorCode = "BAD_REQUEST";
          break;
        case 401:
          errorMessage = "认证失败，请重新登录";
          errorCode = "UNAUTHORIZED";
          localStorage.removeItem("auth_token");
          // 可以触发重新登录事件
          window.dispatchEvent(new CustomEvent("auth:logout"));
          break;
        case 403:
          errorMessage = "权限不足";
          errorCode = "FORBIDDEN";
          break;
        case 404:
          errorMessage = "请求的资源不存在";
          errorCode = "NOT_FOUND";
          break;
        case 429:
          errorMessage = "请求过于频繁，请稍后再试";
          errorCode = "RATE_LIMITED";
          break;
        case 500:
          errorMessage = "服务器内部错误";
          errorCode = "INTERNAL_ERROR";
          break;
        case 502:
        case 503:
        case 504:
          errorMessage = "服务暂时不可用，请稍后再试";
          errorCode = "SERVICE_UNAVAILABLE";
          break;
        default:
          errorMessage = data?.message || `请求失败 (${status})`;
          errorCode = `HTTP_${status}`;
      }
    } else if (error.request) {
      // 网络错误
      if (error.code === "ECONNABORTED") {
        errorMessage = "请求超时，请检查网络连接";
        errorCode = "TIMEOUT";
      } else {
        errorMessage = "网络连接失败，请检查网络设置";
        errorCode = "NETWORK_ERROR";
      }
    } else {
      // 其他错误
      errorMessage = error.message || "未知错误";
      errorCode = "UNKNOWN_ERROR";
    }

    // 创建标准化错误对象
    const standardError = {
      message: errorMessage,
      code: errorCode,
      status: error.response?.status,
      duration,
      timestamp: new Date().toISOString(),
      requestId: error.config?.headers?.["X-Request-ID"],
      originalError: error,
    };

    return Promise.reject(standardError);
  },
);

// ============================================================================
// 服务器管理 API
// ============================================================================

export const serverAPI = {
  // 获取所有服务器（支持分页和过滤）
  async getServers(params?: {
    page?: number;
    limit?: number;
    status?: string;
    transport?: string;
    search?: string;
    tags?: string[];
  }): Promise<{
    data: MCPServer[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  }> {
    const response = await api.get("/v1/servers", { params });
    return response.data;
  },

  // 创建服务器
  async createServer(config: {
    name: string;
    version?: string;
    description?: string;
    port?: number;
    transport?: "streamable" | "sse" | "stdio" | "websocket";
    openApiData: any;
    config?: any;
    authConfig?: string;
    autoStart?: boolean;
    tags?: string[];
  }): Promise<MCPServer> {
    const response = await api.post("/v1/servers", config);
    return response.data;
  },

  // 更新服务器
  async updateServer(
    id: string,
    config: {
      name?: string;
      version?: string;
      description?: string;
      port?: number;
      transport?: "streamable" | "sse" | "stdio" | "websocket";
      openApiData?: any;
      config?: any;
      authConfig?: string;
      autoStart?: boolean;
      tags?: string[];
    },
  ): Promise<MCPServer> {
    const response = await api.put(`/v1/servers/${id}`, config);
    return response.data;
  },

  // 删除服务器
  async deleteServer(
    id: string,
  ): Promise<{ success: boolean; message: string }> {
    const response = await api.delete(`/v1/servers/${id}`);
    return response.data;
  },

  // 服务器操作（启动/停止/重启）
  async performServerAction(
    id: string,
    action: "start" | "stop" | "restart",
    force?: boolean,
  ): Promise<{ success: boolean; message: string }> {
    console.log('🛑 [API DEBUG] performServerAction called with:', { id, action, force });
    console.log('🛑 [API DEBUG] Making POST request to:', `/v1/servers/${id}/actions`);
    
    const requestData = { action, force };
    console.log('🛑 [API DEBUG] Request data:', requestData);
    
    try {
      const response = await api.post(`/v1/servers/${id}/actions`, requestData);
      console.log('🛑 [API DEBUG] Response received:', response.data);
      return response.data;
    } catch (error) {
      console.error('🛑 [API DEBUG] Request failed:', error);
      throw error;
    }
  },

  // 批量服务器操作
  async performBatchAction(
    serverIds: string[],
    action: "start" | "stop" | "restart",
    force?: boolean,
  ): Promise<{ success: boolean; message: string; data?: any }> {
    const response = await api.post("/v1/servers/batch/actions", {
      serverIds,
      action,
      force,
    });
    return response.data;
  },

  // 启动/停止服务器（兼容旧接口）
  async toggleServer(id: string, enabled: boolean): Promise<MCPServer> {
    const response = await api.post(`/servers/${id}/toggle`, { enabled });
    return response.data;
  },

  // 获取服务器详情
  async getServerDetails(id: string): Promise<MCPServer> {
    const response = await api.get(`/v1/servers/${id}`);
    return response.data;
  },

  // 获取服务器健康状态
  async getServerHealth(id: string): Promise<any> {
    const response = await api.get(`/v1/servers/${id}/health`);
    return response.data;
  },

  // 获取所有服务器健康概览
  async getAllServersHealth(): Promise<any> {
    const response = await api.get("/v1/servers/health/overview");
    return response.data;
  },

  // 获取健康检查历史
  async getHealthCheckHistory(id: string, limit?: number): Promise<any> {
    const response = await api.get(`/v1/servers/${id}/health/history`, {
      params: { limit },
    });
    return response.data;
  },

  // 手动执行健康检查
  async performHealthCheck(id: string): Promise<any> {
    const response = await api.post(`/v1/servers/${id}/health/check`);
    return response.data;
  },

  // 获取服务器指标
  async getServerMetrics(
    id: string,
    params?: {
      startTime?: Date;
      endTime?: Date;
      interval?: "minute" | "hour" | "day";
      limit?: number;
    },
  ): Promise<any> {
    const response = await api.get(`/v1/servers/${id}/metrics`, { params });
    return response.data;
  },

  // 获取服务器性能摘要
  async getServerPerformanceSummary(id: string): Promise<any> {
    const response = await api.get(`/v1/servers/${id}/metrics/summary`);
    return response.data;
  },

  // 获取系统指标
  async getSystemMetrics(params?: {
    startTime?: Date;
    endTime?: Date;
    limit?: number;
  }): Promise<any> {
    const response = await api.get("/v1/servers/metrics/system", { params });
    return response.data;
  },

  // ============================================================================
  // 进程监控 API
  // ============================================================================

  // 获取进程资源使用情况
  async getProcessResources(
    id: string,
    limit?: number
  ): Promise<{
    current: {
      pid: number;
      cpu: number;
      memory: number;
      ppid: number;
      ctime: number;
      elapsed: number;
      timestamp: Date;
    };
    history: Array<{
      pid: number;
      cpu: number;
      memory: number;
      ppid: number;
      ctime: number;
      elapsed: number;
      timestamp: Date;
    }>;
    system: {
      totalMemory: number;
      freeMemory: number;
      cpuCount: number;
      loadAverage: number[];
    };
  }> {
    const response = await api.get(`/v1/servers/${id}/process/resources`, {
      params: { limit }
    });
    return response.data;
  },

  // 获取进程日志流
  async getProcessLogStream(
    id: string,
    params?: {
      keyword?: string;
      level?: string;
      limit?: number;
      since?: Date;
    }
  ): Promise<{
    logs: Array<{
      serverId: string;
      pid: number;
      timestamp: Date;
      level: 'stdout' | 'stderr' | 'file';
      source: string;
      message: string;
      metadata?: Record<string, any>;
    }>;
    total: number;
  }> {
    // 使用现有的进程日志接口
    const response = await api.get(`/v1/servers/${id}/process/logs`, {
      params: {
        level: params?.level,
        limit: params?.limit || 100,
        startTime: params?.since?.toISOString(),
        // 注意：后端接口不支持 keyword 参数，如需搜索功能可使用 /process/logs/search 接口
      }
    });
    
    // 转换后端返回的数据格式以匹配前端期望的格式
    const logs = response.data || [];
    return {
      logs: logs.map((log: any) => ({
        serverId: id,
        pid: log.pid || 0,
        timestamp: new Date(log.timestamp || Date.now()),
        level: log.level || 'info',
        source: log.source || 'process',
        message: log.message || '',
        metadata: log.metadata || {}
      })),
      total: logs.length
    };
  },

  // 获取进程完整信息
  async getProcessFullInfo(id: string): Promise<{
    process: {
      pid: number;
      name: string;
      status: string;
      startTime: Date;
      uptime: number;
    };
    resources: {
      cpu: number;
      memory: number;
      handles?: number;
      threads?: number;
    };
    system: {
      platform: string;
      arch: string;
      nodeVersion: string;
    };
    details: any;
  }> {
    const response = await api.get(`/v1/servers/${id}/process/full-info`);
    return response.data;
  },
};

// ============================================================================
// OpenAPI 管理 API
// ============================================================================

export const openApiAPI = {
  // 获取所有规范
  async getSpecs(): Promise<OpenAPISpec[]> {
    const response = await api.get("/openapi/specs");
    return response.data;
  },

  // 创建新规范
  async createSpec(config: {
    name: string;
    version: string;
    description?: string;
    template?: string;
  }): Promise<OpenAPISpec> {
    const response = await api.post("/openapi/specs", config);
    return response.data;
  },

  // 从内容创建规范
  async createSpecFromContent(config: {
    name: string;
    content: string;
    fileName?: string;
  }): Promise<OpenAPISpec> {
    const response = await api.post("/openapi/specs/content", config);
    return response.data;
  },

  // 从URL导入规范
  async importFromUrl(config: {
    url: string;
    name: string;
    authType: "none" | "bearer" | "basic";
    token?: string;
    username?: string;
    password?: string;
  }): Promise<OpenAPISpec> {
    const response = await api.post("/openapi/specs/import", config);
    return response.data;
  },

  // 获取规范内容
  async getSpecContent(id: string): Promise<string> {
    const response = await api.get(`/openapi/specs/${id}/content`);
    return response.data;
  },

  // 更新规范内容
  async updateSpecContent(id: string, content: string): Promise<OpenAPISpec> {
    const response = await api.put(`/openapi/specs/${id}/content`, { content });
    return response.data;
  },

  // 复制规范
  async duplicateSpec(id: string): Promise<OpenAPISpec> {
    const response = await api.post(`/openapi/specs/${id}/duplicate`);
    return response.data;
  },

  // 删除规范
  async deleteSpec(id: string): Promise<void> {
    const response = await api.delete(`/openapi/specs/${id}`);
    return response.data;
  },

  // 上传OpenAPI文件
  async uploadSpec(file: File): Promise<OpenAPISpec> {
    const formData = new FormData();
    formData.append("file", file);
    const response = await api.post("/openapi/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  },

  // 从URL获取OpenAPI规范
  async fetchFromUrl(url: string): Promise<OpenAPISpec> {
    const response = await api.post("/openapi/url", { url });
    return response.data;
  },

  // 验证OpenAPI规范（支持字符串内容）
  async validateSpec(content: string): Promise<ValidationResult> {
    const response = await api.post("/openapi/validate", {
      source: {
        type: "content",
        content: content,
      },
    });
    return response.data;
  },

  // 上传并解析OpenAPI文件
  // async uploadAndParseSpec(file: File): Promise<{
  //   info: any;
  //   paths: Record<string, any>;
  //   endpoints: any[];
  //   tools: any[];
  //   servers: any[];
  //   openapi: string;
  //   components: any;
  //   parsedAt: string;
  //   parseId?: string;
  //   success?:boolean
  // }> {
  //   try {
  //     const formData = new FormData()
  //     formData.append('file', file)
  //     const response = await api.post('/openapi/upload', formData, {
  //       headers: { 'Content-Type': 'multipart/form-data' }
  //     })
  //     // 后端直接返回OpenAPIResponseDto，需要包装成ApiResponse格式
  //     return {
  //       success: true,
  //         ...response
  //     }
  //   } catch (error: any) {
  //     return {
  //       success: false,
  //       data: undefined,
  //       error: error.response?.data?.message || error.message || '文件上传失败'
  //     }
  //   }
  // },

  // 上传并验证OpenAPI文件
  // async uploadAndValidateSpec(file: File): Promise<{
  //   valid: boolean;
  //   errors: string[];
  //   warnings: string[];
  // }> {
  //   try {
  //     const formData = new FormData()
  //     formData.append('file', file)
  //     const response = await api.post('/openapi/validate-upload', formData, {
  //       headers: { 'Content-Type': 'multipart/form-data' }
  //     })
  //     // 后端直接返回验证结果，需要包装成ApiResponse格式
  //     return {
  //       success: response.data.success,
  //       data: response.data,
  //       error: undefined
  //     }
  //   } catch (error: any) {
  //     return {
  //       success: false,
  //       data: undefined,
  //       error: error.response?.data?.message || error.message || '文件验证失败'
  //     }
  //   }
  // },

  // 从URL验证OpenAPI规范
  // async validateSpecFromUrl(url: string): Promise<{
  //   valid: boolean;
  //   errors: string[];
  //   warnings: string[];
  // }> {
  //   try {
  //     const response = await api.get('/openapi/validate-url', {
  //       params: { url }
  //     })
  //     // 后端直接返回验证结果，需要包装成ApiResponse格式
  //     return {
  //       success: true,
  //       data: response.data,
  //       error: undefined
  //     }
  //   } catch (error: any) {
  //     return {
  //       success: false,
  //       data: undefined,
  //       error: error.response?.data?.message || error.message || 'URL验证失败'
  //     }
  //   }
  // },

  // 从URL解析OpenAPI规范
  // async parseSpecFromUrl(url: string): Promise<{
  //   info: any;
  //   paths: Record<string, any>;
  //   endpoints: any[];
  //   tools: any[];
  //   servers: any[];
  //   openapi: string;
  //   components: any;
  //   parsedAt: string;
  //   parseId?: string;
  // }> {
  //   try {
  //     const response = await api.get('/openapi/parse-url', {
  //       params: { url }
  //     })
  //     // 后端直接返回OpenAPIResponseDto，需要包装成ApiResponse格式
  //     return {
  //       success: true,
  //       data: response.data,
  //       error: undefined
  //     }
  //   } catch (error: any) {
  //     return {
  //       success: false,
  //       data: undefined,
  //       error: error.response?.data?.message || error.message || 'URL解析失败'
  //     }
  //   }
  // },

  // 转换为MCP工具
  async convertToMCP(id: string): Promise<MCPTool[]> {
    const response = await api.post(`/openapi/specs/${id}/convert`);
    return response.data;
  },

  // 新增：解析 OpenAPI JSON 内容
  async parseOpenAPIContent(content: string): Promise<{
    info: any;
    paths: Record<string, any>;
    endpoints: any[];
    tools: any[];
    servers: any[];
    openapi: string;
    components: any;
    parsedAt: string;
    parseId?: string;
  }> {
    const response = await api.post("/openapi/parse", {
      source: {
        type: "content",
        content: JSON.stringify(content),
      },
    });
    return response.data;
  },

  // 新增：从 URL 解析 OpenAPI
  async parseOpenAPIFromUrl(
    url: string,
    authHeaders?: Record<string, string>,
  ): Promise<{
    info: any;
    paths: Record<string, any>;
    endpoints: any[];
    tools: any[];
    servers: any[];
    openapi: string;
    components: any;
    parsedAt: string;
    parseId?: string;
  }> {
    const response = await api.post("/openapi/parse", {
      source: {
        type: "url",
        content: url,
      },
      options: {
        authHeaders: authHeaders,
      },
    });
    return response.data;
  },

  // 新增：验证 OpenAPI 规范
  async validateOpenAPIContent(content: string): Promise<ValidationResult> {
    const response = await api.post("/openapi/validate", {
      source: {
        type: "content",
        content: content,
      },
    });
    console.log("respomse", response);

    return response.data;
  },

  // 上传并解析OpenAPI文件
  async uploadAndParseSpec(file: File): Promise<{
    info: any;
    paths: Record<string, any>;
    endpoints: any[];
    tools: any[];
    servers: any[];
    openapi: string;
    components: any;
    parsedAt: string;
    parseId?: string;
  }> {
    const formData = new FormData();
    formData.append("file", file);
    const response = await api.post("/openapi/upload-parse", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  },

  // 上传并验证OpenAPI文件
  async uploadAndValidateSpec(file: File): Promise<ValidationResult> {
    const formData = new FormData();
    formData.append("file", file);
    const response = await api.post("/openapi/upload-validate", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  },

  // 从URL验证OpenAPI规范
  async validateSpecFromUrl(url: string): Promise<ValidationResult> {
    const response = await api.post("/openapi/validate-url", { url });
    return response.data;
  },
};

// ============================================================================
// 监控 API
// ============================================================================

export const monitoringAPI = {
  // 获取系统指标
  async getMetrics(): Promise<SystemMetrics> {
    const response = await api.get("/metrics");
    return response.data;
  },

  // 获取服务器指标
  async getServerMetrics(serverId: string): Promise<SystemMetrics> {
    const response = await api.get(`/metrics/servers/${serverId}`);
    return response.data;
  },
};

// ============================================================================
// API 测试 API
// ============================================================================

export const testingAPI = {
  // 执行工具调用
  async executeTool(toolId: string, parameters: any): Promise<ToolResult> {
    const response = await api.post(`/tools/${toolId}/execute`, { parameters });
    return response.data;
  },

  // 获取测试用例
  async getTestCases(): Promise<TestCase[]> {
    const response = await api.get("/test-cases");
    return response.data;
  },

  // 保存测试用例
  async saveTestCase(
    testCase: Omit<TestCase, "id" | "createdAt" | "updatedAt">,
  ): Promise<TestCase> {
    const response = await api.post("/test-cases", testCase);
    return response.data;
  },

  // 删除测试用例
  async deleteTestCase(id: string): Promise<void> {
    const response = await api.delete(`/test-cases/${id}`);
    return response.data;
  },
};

// ============================================================================
// 用户认证 API
// ============================================================================

export const userAuthAPI = {
  // 用户登录
  async login(credentials: {
    username: string;
    password: string;
  }): Promise<{ accessToken: string; refreshToken: string; user: any }> {
    const response = await api.post("/auth/login", credentials);
    return response.data;
  },

  // 用户注册
  async register(userData: {
    username: string;
    email: string;
    password: string;
  }): Promise<{ user: any; message: string }> {
    const response = await api.post("/auth/register", userData);
    return response.data;
  },

  // 获取当前用户信息
  async getCurrentUser(): Promise<any> {
    const response = await api.get("/auth/me");
    return response.data;
  },

  // 刷新token
  async refreshToken(
    refreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const response = await api.post("/auth/refresh", { refreshToken });
    return response.data;
  },

  // 用户登出
  async logout(): Promise<void> {
    const response = await api.post("/auth/logout");
    return response.data;
  },

  // 邮箱验证
  async verifyEmail(token: string): Promise<{ message: string }> {
    const response = await api.post("/auth/verify-email", { token });
    return response.data;
  },

  // 重置密码请求
  async requestPasswordReset(email: string): Promise<{ message: string }> {
    const response = await api.post("/auth/forgot-password", { email });
    return response.data;
  },

  // 重置密码
  async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const response = await api.post("/auth/reset-password", {
      token,
      newPassword,
    });
    return response.data;
  },
};

// ============================================================================
// 认证管理 API
// ============================================================================

export const authAPI = {
  // 验证认证配置
  async validateAuth(
    config: AuthConfig,
  ): Promise<{ valid: boolean; message: string }> {
    const response = await api.post("/auth/validate", config);
    return response.data;
  },

  // 测试认证连接
  async testAuth(config: AuthConfig): Promise<AuthTestResult> {
    const response = await api.post("/auth/test", config);
    return response.data;
  },

  // 加密凭据
  async encryptCredentials(credentials: any): Promise<string> {
    const response = await api.post("/auth/encrypt", { credentials });
    return response.data;
  },

  // 清除认证信息
  async clearCredentials(serverId: string): Promise<void> {
    const response = await api.delete(`/auth/credentials/${serverId}`);
    return response.data;
  },
};

// ============================================================================
// 配置管理 API
// ============================================================================

export const configAPI = {
  // 导出配置
  async exportConfig(options: ExportOptions): Promise<ConfigFile> {
    const response = await api.post("/config/export", options);
    return response.data;
  },

  // 导入配置
  async importConfig(file: File): Promise<ImportResult> {
    const formData = new FormData();
    formData.append("file", file);
    const response = await api.post("/config/import", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  },

  // 验证配置
  async validateConfig(
    config: any,
  ): Promise<{ valid: boolean; errors: any[] }> {
    const response = await api.post("/config/validate", config);
    return response.data;
  },
};

// ============================================================================
// 日志 API
// ============================================================================

export const logsAPI = {
  // 获取日志
  async getLogs(filter?: LogFilter): Promise<LogEntry[]> {
    const response = await api.get("/logs", { params: filter });
    return response.data;
  },

  // 导出日志
  async exportLogs(filter?: LogFilter): Promise<Blob> {
    const response = await api.get("/logs/export", {
      params: filter,
      responseType: "blob",
    });
    return response.data;
  },
};

// ============================================================================
// AI 助手 API
// ============================================================================

export const aiAPI = {
  // 获取AI助手类型
  async getAssistantTypes(): Promise<AIAssistantType[]> {
    const response = await api.get("/ai/assistants");
    return response.data;
  },

  // 生成配置
  async generateConfig(type: string, options: ConfigOptions): Promise<string> {
    const response = await api.post("/ai/generate-config", { type, options });
    return response.data;
  },

  // 获取配置模板
  async getTemplates(): Promise<ConfigTemplate[]> {
    const response = await api.get("/ai/templates");
    return response.data;
  },

  // 保存配置模板
  async saveTemplate(
    template: Omit<ConfigTemplate, "id" | "createdAt">,
  ): Promise<ConfigTemplate> {
    const response = await api.post("/ai/templates", template);
    return response.data;
  },
};

// ============================================================================
// API 辅助函数
// ============================================================================

/**
 * 创建带重试功能的 API 调用
 */
export function createRetryableAPI<T>(
  apiCall: () => Promise<T>,
  context?: string,
): () => Promise<T> {
  return createRetryFunction(async () => {
    try {
      return await apiCall();
    } catch (error) {
      const normalizedError = normalizeAPIError(error);
      logAPIError(normalizedError, context);
      throw normalizedError;
    }
  });
}

/**
 * 安全的 API 调用包装器
 */
export async function safeAPICall<T>(
  apiCall: () => Promise<ApiResponse<T>>,
  context?: string,
): Promise<T> {
  try {
    const response = await apiCall();
    if (response.success && response.data !== undefined) {
      return response.data;
    } else {
      throw new Error(response.error || response.message || "API调用失败");
    }
  } catch (error) {
    const normalizedError = normalizeAPIError(error);
    logAPIError(normalizedError, context);
    throw normalizedError;
  }
}

/**
 * 批量 API 调用
 */
export async function batchAPICall<T>(
  apiCalls: Array<() => Promise<ApiResponse<T>>>,
  options: {
    concurrent?: boolean;
    failFast?: boolean;
    context?: string;
  } = {},
): Promise<Array<T | APIError>> {
  const { concurrent = true, failFast = false, context } = options;

  if (concurrent) {
    // 并发执行
    const promises = apiCalls.map(async (apiCall, index) => {
      try {
        return await safeAPICall(apiCall, `${context}[${index}]`);
      } catch (error) {
        if (failFast) throw error;
        return error as APIError;
      }
    });

    if (failFast) {
      return await Promise.all(promises);
    } else {
      return await Promise.allSettled(promises).then((results) =>
        results.map((result) =>
          result.status === "fulfilled" ? result.value : result.reason,
        ),
      );
    }
  } else {
    // 顺序执行
    const results: Array<T | APIError> = [];

    for (let i = 0; i < apiCalls.length; i++) {
      try {
        const result = await safeAPICall(apiCalls[i], `${context}[${i}]`);
        results.push(result);
      } catch (error) {
        if (failFast) throw error;
        results.push(error as APIError);
      }
    }

    return results;
  }
}

/**
 * 健康检查 API
 */
export const healthAPI = {
  // 检查 API 健康状态
  async checkHealth(): Promise<
    ApiResponse<{
      status: string;
      timestamp: string;
      services: Record<string, string>;
    }>
  > {
    const response = await api.get("/health");
    return response.data;
  },

  // 检查特定服务健康状态
  async checkServiceHealth(
    serviceName: string,
  ): Promise<ApiResponse<{ status: string; details?: any }>> {
    const response = await api.get(`/health/${serviceName}`);
    return response.data;
  },
};

/**
 * 带重试的服务器 API
 */
export const retryableServerAPI = {
  getServers: createRetryableAPI(() => serverAPI.getServers(), "getServers"),
  createServer: (config: ServerConfig) =>
    createRetryableAPI(() => serverAPI.createServer(config), "createServer")(),
  updateServer: (id: string, config: Partial<ServerConfig>) =>
    createRetryableAPI(
      () => serverAPI.updateServer(id, config),
      "updateServer",
    )(),
  deleteServer: (id: string) =>
    createRetryableAPI(() => serverAPI.deleteServer(id), "deleteServer")(),
  toggleServer: (id: string, enabled: boolean) =>
    createRetryableAPI(
      () => serverAPI.toggleServer(id, enabled),
      "toggleServer",
    )(),
  getServerDetails: (id: string) =>
    createRetryableAPI(
      () => serverAPI.getServerDetails(id),
      "getServerDetails",
    )(),
};

/**
 * 带重试的监控 API
 */
export const retryableMonitoringAPI = {
  getMetrics: createRetryableAPI(
    () => monitoringAPI.getMetrics(),
    "getMetrics",
  ),
  getServerMetrics: (serverId: string) =>
    createRetryableAPI(
      () => monitoringAPI.getServerMetrics(serverId),
      "getServerMetrics",
    )(),
};

export default api;
