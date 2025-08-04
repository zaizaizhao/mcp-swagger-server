// Parser utility functions
import { parseFromString, parseFromUrl } from "mcp-swagger-parser";

/**
 * 检查是否可以使用真实的解析器
 */
export const canUseRealParser = (): boolean => {
  try {
    // 检查mcp-swagger-parser是否可用
    return (
      typeof parseFromString === "function" &&
      typeof parseFromUrl === "function"
    );
  } catch (error) {
    console.warn(
      "Real parser not available, fallback to mock implementation:",
      error,
    );
    return false;
  }
};

/**
 * 获取解析器版本信息
 */
export const getParserVersion = (): string => {
  try {
    // 这里可以从package.json获取版本，现在返回默认值
    return "1.0.0";
  } catch (error) {
    return "unknown";
  }
};
