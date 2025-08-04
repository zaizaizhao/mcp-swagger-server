/**
 * API 错误处理工具
 */

export interface APIError {
  message: string;
  code: string;
  status?: number;
  duration?: number;
  timestamp?: string;
  requestId?: string;
  originalError?: any;
}

export interface APIErrorOptions {
  showNotification?: boolean;
  logError?: boolean;
  retryable?: boolean;
}

/**
 * 标准化 API 错误
 */
export function normalizeAPIError(error: any): APIError {
  // 如果已经是标准化错误，直接返回
  if (error.code && error.message) {
    return error as APIError;
  }

  let message = "请求失败";
  let code = "UNKNOWN_ERROR";
  let status: number | undefined;

  if (error.response) {
    // HTTP 响应错误
    status = error.response.status;
    const data = error.response.data;

    switch (status) {
      case 400:
        message = data?.message || "请求参数错误";
        code = "BAD_REQUEST";
        break;
      case 401:
        message = "认证失败，请重新登录";
        code = "UNAUTHORIZED";
        break;
      case 403:
        message = "权限不足";
        code = "FORBIDDEN";
        break;
      case 404:
        message = "请求的资源不存在";
        code = "NOT_FOUND";
        break;
      case 409:
        message = data?.message || "资源冲突";
        code = "CONFLICT";
        break;
      case 422:
        message = data?.message || "数据验证失败";
        code = "VALIDATION_ERROR";
        break;
      case 429:
        message = "请求过于频繁，请稍后再试";
        code = "RATE_LIMITED";
        break;
      case 500:
        message = "服务器内部错误";
        code = "INTERNAL_ERROR";
        break;
      case 502:
      case 503:
      case 504:
        message = "服务暂时不可用，请稍后再试";
        code = "SERVICE_UNAVAILABLE";
        break;
      default:
        message = data?.message || `请求失败 (${status})`;
        code = `HTTP_${status}`;
    }
  } else if (error.request) {
    // 网络错误
    if (error.code === "ECONNABORTED") {
      message = "请求超时，请检查网络连接";
      code = "TIMEOUT";
    } else if (error.code === "ERR_NETWORK") {
      message = "网络连接失败，请检查网络设置";
      code = "NETWORK_ERROR";
    } else {
      message = "网络请求失败";
      code = "REQUEST_ERROR";
    }
  } else {
    // 其他错误
    message = error.message || "未知错误";
    code = "UNKNOWN_ERROR";
  }

  return {
    message,
    code,
    status,
    timestamp: new Date().toISOString(),
    originalError: error,
  };
}

/**
 * 检查错误是否可重试
 */
export function isRetryableError(error: APIError): boolean {
  const retryableCodes = [
    "TIMEOUT",
    "NETWORK_ERROR",
    "SERVICE_UNAVAILABLE",
    "HTTP_502",
    "HTTP_503",
    "HTTP_504",
  ];

  return retryableCodes.includes(error.code);
}

/**
 * 检查错误是否需要认证
 */
export function isAuthError(error: APIError): boolean {
  return error.code === "UNAUTHORIZED";
}

/**
 * 检查错误是否是客户端错误
 */
export function isClientError(error: APIError): boolean {
  return error.status ? error.status >= 400 && error.status < 500 : false;
}

/**
 * 检查错误是否是服务器错误
 */
export function isServerError(error: APIError): boolean {
  return error.status ? error.status >= 500 : false;
}

/**
 * 获取用户友好的错误消息
 */
export function getUserFriendlyMessage(error: APIError): string {
  const friendlyMessages: Record<string, string> = {
    NETWORK_ERROR: "网络连接异常，请检查您的网络设置",
    TIMEOUT: "请求超时，请稍后重试",
    UNAUTHORIZED: "登录已过期，请重新登录",
    FORBIDDEN: "您没有权限执行此操作",
    NOT_FOUND: "请求的内容不存在",
    VALIDATION_ERROR: "输入的数据格式不正确",
    RATE_LIMITED: "操作过于频繁，请稍后再试",
    SERVICE_UNAVAILABLE: "服务暂时不可用，请稍后重试",
    INTERNAL_ERROR: "系统出现问题，请联系管理员",
  };

  return friendlyMessages[error.code] || error.message;
}

/**
 * 错误重试配置
 */
export interface RetryConfig {
  maxAttempts: number;
  delay: number;
  backoff: "linear" | "exponential";
  retryCondition?: (error: APIError) => boolean;
}

/**
 * 默认重试配置
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  delay: 1000,
  backoff: "exponential",
  retryCondition: isRetryableError,
};

/**
 * 计算重试延迟
 */
export function calculateRetryDelay(
  attempt: number,
  config: RetryConfig,
): number {
  const { delay, backoff } = config;

  switch (backoff) {
    case "exponential":
      return delay * Math.pow(2, attempt - 1);
    case "linear":
    default:
      return delay * attempt;
  }
}

/**
 * 创建重试函数
 */
export function createRetryFunction<T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
): () => Promise<T> {
  return async (): Promise<T> => {
    let lastError: APIError;

    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = normalizeAPIError(error);

        // 如果不满足重试条件，直接抛出错误
        if (config.retryCondition && !config.retryCondition(lastError)) {
          throw lastError;
        }

        // 如果是最后一次尝试，抛出错误
        if (attempt === config.maxAttempts) {
          throw lastError;
        }

        // 等待后重试
        const delay = calculateRetryDelay(attempt, config);
        await new Promise((resolve) => setTimeout(resolve, delay));

        console.warn(
          `API request failed, retrying (${attempt}/${config.maxAttempts}) after ${delay}ms:`,
          lastError.message,
        );
      }
    }

    throw lastError!;
  };
}

/**
 * API 错误日志记录
 */
export function logAPIError(error: APIError, context?: string): void {
  const logData = {
    message: error.message,
    code: error.code,
    status: error.status,
    timestamp: error.timestamp,
    requestId: error.requestId,
    context,
  };

  if (isServerError(error)) {
    console.error("Server Error:", logData);
  } else if (isClientError(error)) {
    console.warn("Client Error:", logData);
  } else {
    console.error("API Error:", logData);
  }
}
