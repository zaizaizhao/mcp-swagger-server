import yaml from "js-yaml";
import type { OpenAPISpec, ValidationResult } from "@/types";

/**
 * 解析OpenAPI内容
 */
export const parseOpenAPI = (
  content: string,
): { data: any; error?: string } => {
  try {
    // 尝试解析为JSON
    if (content.trim().startsWith("{")) {
      const data = JSON.parse(content);
      return { data };
    }

    // 尝试解析为YAML
    const data = yaml.load(content, {
      schema: yaml.JSON_SCHEMA,
      json: true,
    });
    return { data };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : "解析失败",
    };
  }
};

/**
 * 验证OpenAPI规范
 */
export const validateOpenAPI = (content: string): ValidationResult => {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
  };

  try {
    const { data, error } = parseOpenAPI(content);

    if (error) {
      result.valid = false;
      result.errors = [
        {
          path: "",
          message: `解析错误: ${error}`,
          severity: "error" as const,
          code: "PARSE_ERROR",
        },
      ];
      return result;
    }

    if (!data) {
      result.valid = false;
      result.errors = [
        {
          path: "",
          message: "内容为空或无效",
          severity: "error" as const,
          code: "EMPTY_CONTENT",
        },
      ];
      return result;
    }

    // 验证OpenAPI版本
    if (!data.openapi && !data.swagger) {
      result.valid = false;
      result.errors!.push({
        path: "openapi",
        message: "缺少OpenAPI版本字段 (openapi 或 swagger)",
        severity: "error" as const,
        code: "MISSING_VERSION",
      });
    }

    // 验证info字段
    if (!data.info) {
      result.valid = false;
      result.errors!.push({
        path: "info",
        message: "缺少info字段",
        severity: "error" as const,
        code: "MISSING_INFO",
      });
    } else {
      if (!data.info.title) {
        result.valid = false;
        result.errors!.push({
          path: "info.title",
          message: "缺少API标题",
          severity: "error" as const,
          code: "MISSING_TITLE",
        });
      }

      if (!data.info.version) {
        result.valid = false;
        result.errors!.push({
          path: "info.version",
          message: "缺少API版本",
          severity: "error" as const,
          code: "MISSING_VERSION",
        });
      }
    }

    // 验证paths字段
    if (!data.paths) {
      result.warnings = result.warnings || [];
      result.warnings.push({
        path: "paths",
        message: "API规范中没有定义任何路径",
        severity: "warning" as const,
        code: "NO_PATHS",
      });
    } else if (Object.keys(data.paths).length === 0) {
      result.warnings = result.warnings || [];
      result.warnings.push({
        path: "paths",
        message: "paths字段为空",
        severity: "warning" as const,
        code: "EMPTY_PATHS",
      });
    }

    // 如果有警告但没有错误，仍然视为有效
    if (result.errors!.length === 0) {
      result.valid = true;
    }
  } catch (error) {
    result.valid = false;
    result.errors = [
      {
        path: "",
        message:
          error instanceof Error ? error.message : "验证过程中发生未知错误",
        severity: "error" as const,
        code: "VALIDATION_ERROR",
      },
    ];
  }

  return result;
};

/**
 * 从OpenAPI规范提取API路径
 */
export const extractApiPaths = (
  content: string,
): Array<{
  method: string;
  path: string;
  summary?: string;
  description?: string;
}> => {
  try {
    const { data, error } = parseOpenAPI(content);

    if (error || !data || !data.paths) {
      return [];
    }

    const paths: Array<{
      method: string;
      path: string;
      summary?: string;
      description?: string;
    }> = [];

    Object.entries(data.paths).forEach(([path, pathItem]: [string, any]) => {
      if (!pathItem || typeof pathItem !== "object") return;

      const methods = [
        "get",
        "post",
        "put",
        "delete",
        "patch",
        "head",
        "options",
      ];

      methods.forEach((method) => {
        if (pathItem[method]) {
          const operation = pathItem[method];
          paths.push({
            method,
            path,
            summary: operation.summary,
            description: operation.description,
          });
        }
      });
    });

    return paths;
  } catch (error) {
    console.error("Error extracting API paths:", error);
    return [];
  }
};

/**
 * 计算OpenAPI规范统计信息
 */
export const calculateOpenAPIStats = (
  content: string,
): {
  pathCount: number;
  toolCount: number;
  methodCounts: Record<string, number>;
} => {
  try {
    const { data, error } = parseOpenAPI(content);

    if (error || !data || !data.paths) {
      return {
        pathCount: 0,
        toolCount: 0,
        methodCounts: {},
      };
    }

    const methodCounts: Record<string, number> = {};
    let toolCount = 0;

    Object.entries(data.paths).forEach(([path, pathItem]: [string, any]) => {
      if (!pathItem || typeof pathItem !== "object") return;

      const methods = [
        "get",
        "post",
        "put",
        "delete",
        "patch",
        "head",
        "options",
      ];

      methods.forEach((method) => {
        if (pathItem[method]) {
          methodCounts[method] = (methodCounts[method] || 0) + 1;
          toolCount++;
        }
      });
    });

    return {
      pathCount: Object.keys(data.paths).length,
      toolCount,
      methodCounts,
    };
  } catch (error) {
    console.error("Error calculating OpenAPI stats:", error);
    return {
      pathCount: 0,
      toolCount: 0,
      methodCounts: {},
    };
  }
};

/**
 * 格式化OpenAPI内容
 */
export const formatOpenAPI = (
  content: string,
  format: "json" | "yaml" = "yaml",
): string => {
  try {
    const { data, error } = parseOpenAPI(content);

    if (error || !data) {
      return content;
    }

    if (format === "json") {
      return JSON.stringify(data, null, 2);
    } else {
      return yaml.dump(data, {
        indent: 2,
        lineWidth: 120,
        noRefs: true,
        sortKeys: false,
      });
    }
  } catch (error) {
    console.error("Error formatting OpenAPI content:", error);
    return content;
  }
};

/**
 * 从OpenAPI规范转换为MCP工具
 */
export const convertOpenAPIToMCPTools = (content: string): any[] => {
  try {
    const { data, error } = parseOpenAPI(content);

    if (error || !data || !data.paths) {
      return [];
    }

    const tools: any[] = [];

    Object.entries(data.paths).forEach(([path, pathItem]: [string, any]) => {
      if (!pathItem || typeof pathItem !== "object") return;

      const methods = [
        "get",
        "post",
        "put",
        "delete",
        "patch",
        "head",
        "options",
      ];

      methods.forEach((method) => {
        if (pathItem[method]) {
          const operation = pathItem[method];
          const toolName =
            operation.operationId ||
            `${method}_${path.replace(/[^a-zA-Z0-9]/g, "_")}`;

          // 构建参数schema
          const parameters: any = {
            type: "object",
            properties: {},
            required: [],
          };

          // 处理路径参数
          if (operation.parameters) {
            operation.parameters.forEach((param: any) => {
              if (param.in === "path" || param.in === "query") {
                parameters.properties[param.name] = {
                  type: param.schema?.type || "string",
                  description: param.description,
                  ...(param.schema?.default && {
                    default: param.schema.default,
                  }),
                  ...(param.schema?.enum && { enum: param.schema.enum }),
                };

                if (param.required) {
                  parameters.required.push(param.name);
                }
              }
            });
          }

          // 处理请求体参数
          if (operation.requestBody && operation.requestBody.content) {
            const contentType = Object.keys(operation.requestBody.content)[0];
            const schema = operation.requestBody.content[contentType]?.schema;

            if (schema && schema.properties) {
              Object.entries(schema.properties).forEach(
                ([propName, propSchema]: [string, any]) => {
                  parameters.properties[propName] = {
                    type: propSchema.type || "string",
                    description: propSchema.description,
                    ...(propSchema.default && { default: propSchema.default }),
                    ...(propSchema.enum && { enum: propSchema.enum }),
                  };
                },
              );

              if (schema.required) {
                parameters.required.push(...schema.required);
              }
            }
          }

          tools.push({
            id: `tool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: toolName,
            description:
              operation.summary ||
              operation.description ||
              `${method.toUpperCase()} ${path}`,
            method: method.toUpperCase(),
            endpoint: path,
            path: path,
            parameters: parameters,
            serverId: "openapi",
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
      });
    });

    return tools;
  } catch (error) {
    console.error("Error converting OpenAPI to MCP tools:", error);
    return [];
  }
};
export const createOpenAPITemplate = (config: {
  title: string;
  version: string;
  description?: string;
  serverUrl?: string;
}): string => {
  const template = {
    openapi: "3.0.3",
    info: {
      title: config.title,
      version: config.version,
      description: config.description || `${config.title} API`,
    },
    servers: config.serverUrl ? [{ url: config.serverUrl }] : [],
    paths: {
      "/health": {
        get: {
          summary: "健康检查",
          description: "检查API服务状态",
          responses: {
            "200": {
              description: "服务正常",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      status: {
                        type: "string",
                        example: "ok",
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    components: {
      schemas: {},
      securitySchemes: {},
    },
  };

  return yaml.dump(template, {
    indent: 2,
    lineWidth: 120,
    noRefs: true,
    sortKeys: false,
  });
};
