import type {
  ParameterSchema,
  PropertySchema,
  MCPTool,
  ValidationError,
} from "@/types";

// ============================================================================
// 参数模式验证
// ============================================================================

/**
 * 验证参数是否符合模式定义
 */
export const validateParametersAgainstSchema = (
  parameters: Record<string, any>,
  schema: ParameterSchema,
): ValidationError[] => {
  const errors: ValidationError[] = [];

  // 检查必需参数
  if (schema.required) {
    for (const requiredField of schema.required) {
      if (
        !(requiredField in parameters) ||
        parameters[requiredField] === undefined ||
        parameters[requiredField] === null
      ) {
        errors.push({
          path: requiredField,
          message: `必需参数 '${requiredField}' 缺失`,
          severity: "error",
          code: "REQUIRED_PARAMETER_MISSING",
        });
      }
    }
  }

  // 验证每个参数
  if (schema.properties) {
    for (const [key, value] of Object.entries(parameters)) {
      const propertySchema = schema.properties[key];
      if (propertySchema) {
        const propertyErrors = validateValueAgainstProperty(
          value,
          propertySchema,
          key,
        );
        errors.push(...propertyErrors);
      } else {
        // 未定义的参数（警告）
        errors.push({
          path: key,
          message: `参数 '${key}' 未在模式中定义`,
          severity: "warning",
          code: "UNDEFINED_PARAMETER",
        });
      }
    }
  }

  return errors;
};

/**
 * 验证值是否符合属性模式
 */
export const validateValueAgainstProperty = (
  value: any,
  schema: PropertySchema,
  path: string,
): ValidationError[] => {
  const errors: ValidationError[] = [];

  // 如果值为 null 或 undefined，检查是否允许
  if (value === null || value === undefined) {
    return errors; // 在上层检查必需字段
  }

  // 类型验证
  const actualType = getValueType(value);
  if (actualType !== schema.type) {
    errors.push({
      path,
      message: `参数类型错误：期望 ${schema.type}，实际 ${actualType}`,
      severity: "error",
      code: "TYPE_MISMATCH",
    });
    return errors; // 类型错误时不继续验证
  }

  // 枚举值验证
  if (schema.enum && schema.enum.length > 0) {
    if (!schema.enum.includes(value)) {
      errors.push({
        path,
        message: `参数值必须是以下之一：${schema.enum.join(", ")}`,
        severity: "error",
        code: "ENUM_VIOLATION",
      });
    }
  }

  // 格式验证
  if (schema.format && typeof value === "string") {
    const formatErrors = validateStringFormat(value, schema.format, path);
    errors.push(...formatErrors);
  }

  // 数组验证
  if (schema.type === "array" && Array.isArray(value)) {
    if (schema.items) {
      value.forEach((item, index) => {
        const itemErrors = validateValueAgainstProperty(
          item,
          schema.items!,
          `${path}[${index}]`,
        );
        errors.push(...itemErrors);
      });
    }
  }

  // 对象验证
  if (schema.type === "object" && typeof value === "object" && value !== null) {
    if (schema.properties) {
      for (const [key, subValue] of Object.entries(value)) {
        const subSchema = schema.properties[key];
        if (subSchema) {
          const subErrors = validateValueAgainstProperty(
            subValue,
            subSchema,
            `${path}.${key}`,
          );
          errors.push(...subErrors);
        }
      }
    }
  }

  return errors;
};

/**
 * 获取值的类型
 */
const getValueType = (value: any): string => {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "object") return "object";
  return typeof value;
};

/**
 * 验证字符串格式
 */
const validateStringFormat = (
  value: string,
  format: string,
  path: string,
): ValidationError[] => {
  const errors: ValidationError[] = [];

  switch (format) {
    case "email":
      if (!isValidEmail(value)) {
        errors.push({
          path,
          message: "邮箱格式无效",
          severity: "error",
          code: "INVALID_EMAIL_FORMAT",
        });
      }
      break;

    case "uri":
    case "url":
      if (!isValidUrl(value)) {
        errors.push({
          path,
          message: "URL 格式无效",
          severity: "error",
          code: "INVALID_URL_FORMAT",
        });
      }
      break;

    case "date":
      if (!isValidDate(value)) {
        errors.push({
          path,
          message: "日期格式无效，应为 YYYY-MM-DD",
          severity: "error",
          code: "INVALID_DATE_FORMAT",
        });
      }
      break;

    case "date-time":
      if (!isValidDateTime(value)) {
        errors.push({
          path,
          message: "日期时间格式无效，应为 ISO 8601 格式",
          severity: "error",
          code: "INVALID_DATETIME_FORMAT",
        });
      }
      break;

    case "uuid":
      if (!isValidUUID(value)) {
        errors.push({
          path,
          message: "UUID 格式无效",
          severity: "error",
          code: "INVALID_UUID_FORMAT",
        });
      }
      break;

    case "ipv4":
      if (!isValidIPv4(value)) {
        errors.push({
          path,
          message: "IPv4 地址格式无效",
          severity: "error",
          code: "INVALID_IPV4_FORMAT",
        });
      }
      break;

    case "ipv6":
      if (!isValidIPv6(value)) {
        errors.push({
          path,
          message: "IPv6 地址格式无效",
          severity: "error",
          code: "INVALID_IPV6_FORMAT",
        });
      }
      break;
  }

  return errors;
};

// ============================================================================
// 格式验证函数
// ============================================================================

/**
 * 验证邮箱格式
 */
const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * 验证 URL 格式
 */
const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

/**
 * 验证日期格式 (YYYY-MM-DD)
 */
const isValidDate = (date: string): boolean => {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) return false;

  const parsedDate = new Date(date);
  return parsedDate.toISOString().startsWith(date);
};

/**
 * 验证日期时间格式 (ISO 8601)
 */
const isValidDateTime = (dateTime: string): boolean => {
  try {
    const date = new Date(dateTime);
    return (
      date.toISOString() === dateTime ||
      date.toISOString().replace("Z", "+00:00") === dateTime
    );
  } catch {
    return false;
  }
};

/**
 * 验证 UUID 格式
 */
const isValidUUID = (uuid: string): boolean => {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

/**
 * 验证 IPv4 地址格式
 */
const isValidIPv4 = (ip: string): boolean => {
  const ipv4Regex =
    /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  return ipv4Regex.test(ip);
};

/**
 * 验证 IPv6 地址格式
 */
const isValidIPv6 = (ip: string): boolean => {
  const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::1$|^::$/;
  return ipv6Regex.test(ip);
};

// ============================================================================
// 参数自动补全和建议
// ============================================================================

/**
 * 为工具参数生成自动补全建议
 */
export const generateParameterSuggestions = (
  tool: MCPTool,
  currentParameters: Record<string, any>,
): Record<string, any[]> => {
  const suggestions: Record<string, any[]> = {};

  if (!tool.parameters.properties) return suggestions;

  for (const [key, schema] of Object.entries(tool.parameters.properties)) {
    suggestions[key] = generateValueSuggestions(schema, currentParameters[key]);
  }

  return suggestions;
};

/**
 * 为属性生成值建议
 */
const generateValueSuggestions = (
  schema: PropertySchema,
  currentValue?: any,
): any[] => {
  const suggestions: any[] = [];

  // 枚举值建议
  if (schema.enum && schema.enum.length > 0) {
    return [...schema.enum];
  }

  // 默认值建议
  if (schema.default !== undefined) {
    suggestions.push(schema.default);
  }

  // 根据类型和格式生成建议
  switch (schema.type) {
    case "string":
      suggestions.push(...generateStringSuggestions(schema.format));
      break;
    case "number":
      suggestions.push(0, 1, 10, 100);
      break;
    case "boolean":
      suggestions.push(true, false);
      break;
    case "array":
      suggestions.push([]);
      break;
    case "object":
      suggestions.push({});
      break;
  }

  return suggestions.slice(0, 10); // 限制建议数量
};

/**
 * 生成字符串类型的建议值
 */
const generateStringSuggestions = (format?: string): string[] => {
  switch (format) {
    case "email":
      return ["user@example.com", "admin@company.com", "test@test.com"];
    case "uri":
    case "url":
      return [
        "https://api.example.com",
        "https://www.example.com",
        "http://localhost:3000",
      ];
    case "date":
      const today = new Date().toISOString().split("T")[0];
      return [today, "2024-01-01", "2024-12-31"];
    case "date-time":
      return [
        new Date().toISOString(),
        "2024-01-01T00:00:00Z",
        "2024-12-31T23:59:59Z",
      ];
    case "uuid":
      return ["123e4567-e89b-12d3-a456-426614174000"];
    case "ipv4":
      return ["192.168.1.1", "127.0.0.1", "10.0.0.1"];
    case "ipv6":
      return ["::1", "2001:db8::1", "fe80::1"];
    default:
      return ["example", "test", "sample"];
  }
};

// ============================================================================
// 参数模式工具函数
// ============================================================================

/**
 * 检查参数模式是否为空
 */
export const isEmptySchema = (schema: ParameterSchema): boolean => {
  return !schema.properties || Object.keys(schema.properties).length === 0;
};

/**
 * 获取模式中的必需参数列表
 */
export const getRequiredParameters = (schema: ParameterSchema): string[] => {
  return schema.required || [];
};

/**
 * 获取模式中的可选参数列表
 */
export const getOptionalParameters = (schema: ParameterSchema): string[] => {
  if (!schema.properties) return [];

  const allParameters = Object.keys(schema.properties);
  const requiredParameters = getRequiredParameters(schema);

  return allParameters.filter((param) => !requiredParameters.includes(param));
};

/**
 * 检查参数是否为必需
 */
export const isRequiredParameter = (
  parameterName: string,
  schema: ParameterSchema,
): boolean => {
  return getRequiredParameters(schema).includes(parameterName);
};

/**
 * 获取参数的描述信息
 */
export const getParameterDescription = (
  parameterName: string,
  schema: ParameterSchema,
): string => {
  const property = schema.properties?.[parameterName];
  return property?.description || "";
};

/**
 * 获取参数的类型信息
 */
export const getParameterType = (
  parameterName: string,
  schema: ParameterSchema,
): string => {
  const property = schema.properties?.[parameterName];
  return property?.type || "unknown";
};

/**
 * 检查参数是否有枚举值
 */
export const hasEnumValues = (
  parameterName: string,
  schema: ParameterSchema,
): boolean => {
  const property = schema.properties?.[parameterName];
  return !!(property?.enum && property.enum.length > 0);
};

/**
 * 获取参数的枚举值
 */
export const getEnumValues = (
  parameterName: string,
  schema: ParameterSchema,
): any[] => {
  const property = schema.properties?.[parameterName];
  return property?.enum || [];
};
