import { ref, reactive } from "vue";
import { defineStore } from "pinia";
import type { TestCase, MCPTool, ToolResult } from "@/types";
import { useAppStore } from "./app";

export const useTestingStore = defineStore("testing", () => {
  const appStore = useAppStore();

  // State
  const testCases = ref<TestCase[]>([]);
  const activeTestCase = ref<TestCase | null>(null);
  const testResults = ref<Map<string, ToolResult>>(new Map());
  const loading = ref(false);
  const error = ref<string | null>(null);

  // 测试历史记录
  const testHistory = ref<
    Array<{
      id: string;
      testCaseId: string;
      toolId: string;
      parameters: Record<string, any>;
      result: ToolResult;
      timestamp: Date;
    }>
  >([]);

  // Actions
  const setLoading = (value: boolean) => {
    loading.value = value;
  };

  const setError = (value: string | null) => {
    error.value = value;
  };

  const clearError = () => {
    error.value = null;
  };

  // 创建测试用例
  const createTestCase = (data: {
    name: string;
    toolId: string;
    parameters: Record<string, any>;
    expectedResult?: any;
    tags?: string[];
  }): TestCase => {
    const testCase: TestCase = {
      id: `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: data.name,
      toolId: data.toolId,
      parameters: data.parameters,
      expectedResult: data.expectedResult,
      tags: data.tags || [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    testCases.value.push(testCase);

    appStore.addNotification({
      type: "success",
      title: "测试用例创建成功",
      message: `测试用例 "${data.name}" 已创建`,
      duration: 3000,
    });

    return testCase;
  };

  // 更新测试用例
  const updateTestCase = (id: string, updates: Partial<TestCase>) => {
    const index = testCases.value.findIndex((tc) => tc.id === id);
    if (index !== -1) {
      testCases.value[index] = {
        ...testCases.value[index],
        ...updates,
        updatedAt: new Date(),
      };

      appStore.addNotification({
        type: "success",
        title: "测试用例更新成功",
        message: `测试用例已更新`,
        duration: 3000,
      });
    }
  };

  // 删除测试用例
  const deleteTestCase = (id: string) => {
    const index = testCases.value.findIndex((tc) => tc.id === id);
    if (index !== -1) {
      const testCase = testCases.value[index];
      testCases.value.splice(index, 1);

      // 清理相关的测试结果
      testResults.value.delete(id);

      // 清理测试历史
      testHistory.value = testHistory.value.filter((h) => h.testCaseId !== id);

      appStore.addNotification({
        type: "success",
        title: "测试用例删除成功",
        message: `测试用例 "${testCase.name}" 已删除`,
        duration: 3000,
      });
    }
  };

  // 执行工具测试
  const executeToolTest = async (
    tool: MCPTool,
    parameters: Record<string, any>,
  ): Promise<ToolResult> => {
    setLoading(true);
    clearError();

    try {
      // 模拟工具执行逻辑
      const startTime = Date.now();

      // 参数验证
      const validationErrors = validateParameters(tool, parameters);
      if (validationErrors.length > 0) {
        throw new Error(`参数验证失败: ${validationErrors.join(", ")}`);
      }

      // 模拟API调用
      await new Promise((resolve) =>
        setTimeout(resolve, 500 + Math.random() * 1000),
      );

      // 模拟结果
      const success = Math.random() > 0.2; // 80%成功率
      const executionTime = Date.now() - startTime;

      let result: ToolResult;

      if (success) {
        result = {
          success: true,
          data: generateMockResponse(tool, parameters),
          executionTime,
          timestamp: new Date(),
        };
      } else {
        result = {
          success: false,
          error: generateMockError(),
          executionTime,
          timestamp: new Date(),
        };
      }

      // 记录测试历史
      testHistory.value.unshift({
        id: `history_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        testCaseId: "",
        toolId: tool.id,
        parameters: { ...parameters },
        result: { ...result },
        timestamp: new Date(),
      });

      // 限制历史记录数量
      if (testHistory.value.length > 100) {
        testHistory.value = testHistory.value.slice(0, 100);
      }

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "工具执行失败";
      setError(errorMessage);

      const result: ToolResult = {
        success: false,
        error: errorMessage,
        executionTime: Date.now(),
        timestamp: new Date(),
      };

      return result;
    } finally {
      setLoading(false);
    }
  };

  // 参数验证
  const validateParameters = (
    tool: MCPTool,
    parameters: Record<string, any>,
  ): string[] => {
    const errors: string[] = [];

    if (!tool.parameters || tool.parameters.type !== "object") {
      return errors;
    }

    const required = tool.parameters.required || [];
    const properties = tool.parameters.properties || {};

    // 检查必需参数
    for (const requiredParam of required) {
      if (
        !(requiredParam in parameters) ||
        parameters[requiredParam] === undefined ||
        parameters[requiredParam] === ""
      ) {
        errors.push(`缺少必需参数: ${requiredParam}`);
      }
    }

    // 检查参数类型
    for (const [paramName, paramValue] of Object.entries(parameters)) {
      if (paramValue === undefined || paramValue === "") continue;

      const paramSchema = properties[paramName];
      if (!paramSchema) continue;

      const typeError = validateParameterType(
        paramName,
        paramValue,
        paramSchema,
      );
      if (typeError) {
        errors.push(typeError);
      }
    }

    return errors;
  };

  // 验证参数类型
  const validateParameterType = (
    name: string,
    value: any,
    schema: any,
  ): string | null => {
    const {
      type,
      format,
      minimum,
      maximum,
      minLength,
      maxLength,
      pattern,
      enum: enumValues,
    } = schema;

    switch (type) {
      case "string":
        if (typeof value !== "string") {
          return `参数 ${name} 应为字符串类型`;
        }
        if (minLength !== undefined && value.length < minLength) {
          return `参数 ${name} 长度不能少于 ${minLength} 个字符`;
        }
        if (maxLength !== undefined && value.length > maxLength) {
          return `参数 ${name} 长度不能超过 ${maxLength} 个字符`;
        }
        if (pattern && !new RegExp(pattern).test(value)) {
          return `参数 ${name} 格式不正确`;
        }
        if (enumValues && !enumValues.includes(value)) {
          return `参数 ${name} 必须为: ${enumValues.join(", ")} 中的一个`;
        }
        break;

      case "number":
      case "integer":
        const numValue = Number(value);
        if (isNaN(numValue)) {
          return `参数 ${name} 应为数字类型`;
        }
        if (type === "integer" && !Number.isInteger(numValue)) {
          return `参数 ${name} 应为整数`;
        }
        if (minimum !== undefined && numValue < minimum) {
          return `参数 ${name} 不能小于 ${minimum}`;
        }
        if (maximum !== undefined && numValue > maximum) {
          return `参数 ${name} 不能大于 ${maximum}`;
        }
        break;

      case "boolean":
        if (typeof value !== "boolean") {
          return `参数 ${name} 应为布尔类型`;
        }
        break;

      case "array":
        if (!Array.isArray(value)) {
          return `参数 ${name} 应为数组类型`;
        }
        break;

      case "object":
        if (
          typeof value !== "object" ||
          value === null ||
          Array.isArray(value)
        ) {
          return `参数 ${name} 应为对象类型`;
        }
        break;
    }

    return null;
  };

  // 生成模拟响应
  const generateMockResponse = (
    tool: MCPTool,
    parameters: Record<string, any>,
  ) => {
    const responses = {
      get: {
        id: Math.floor(Math.random() * 1000),
        name: "测试数据",
        status: "active",
        data: parameters,
        timestamp: new Date().toISOString(),
      },
      post: {
        id: Math.floor(Math.random() * 1000),
        message: "创建成功",
        created: parameters,
        timestamp: new Date().toISOString(),
      },
      put: {
        id: Math.floor(Math.random() * 1000),
        message: "更新成功",
        updated: parameters,
        timestamp: new Date().toISOString(),
      },
      delete: {
        message: "删除成功",
        deleted_id: parameters.id || Math.floor(Math.random() * 1000),
        timestamp: new Date().toISOString(),
      },
    };

    const method = tool.method.toLowerCase();
    return responses[method as keyof typeof responses] || responses.get;
  };

  // 生成模拟错误
  const generateMockError = (): string => {
    const errors = [
      "网络连接超时",
      "服务器内部错误 (500)",
      "资源未找到 (404)",
      "访问被拒绝 (403)",
      "请求参数错误 (400)",
      "认证失败 (401)",
      "请求频率限制 (429)",
    ];

    return errors[Math.floor(Math.random() * errors.length)];
  };

  // 从工具生成测试用例模板
  const generateTestCaseTemplate = (tool: MCPTool): Partial<TestCase> => {
    const parameters: Record<string, any> = {};

    if (tool.parameters && tool.parameters.properties) {
      Object.entries(tool.parameters.properties).forEach(([name, schema]) => {
        parameters[name] = getDefaultValue(schema);
      });
    }

    return {
      name: `${tool.name} 测试用例`,
      toolId: tool.id,
      parameters,
      tags: [tool.method.toUpperCase(), "auto-generated"],
    };
  };

  // 获取参数默认值
  const getDefaultValue = (schema: any): any => {
    if (schema.default !== undefined) {
      return schema.default;
    }

    switch (schema.type) {
      case "string":
        return schema.format === "email"
          ? "test@example.com"
          : schema.format === "date"
            ? new Date().toISOString().split("T")[0]
            : schema.format === "date-time"
              ? new Date().toISOString()
              : "test value";
      case "number":
        return schema.minimum || 0;
      case "integer":
        return schema.minimum || 1;
      case "boolean":
        return false;
      case "array":
        return [];
      case "object":
        return {};
      default:
        return "";
    }
  };

  // 按标签筛选测试用例
  const getTestCasesByTag = (tag: string): TestCase[] => {
    return testCases.value.filter((tc) => tc.tags.includes(tag));
  };

  // 按工具ID筛选测试用例
  const getTestCasesByTool = (toolId: string): TestCase[] => {
    return testCases.value.filter((tc) => tc.toolId === toolId);
  };

  // 获取最近的测试历史
  const getRecentTestHistory = (limit: number = 10) => {
    return testHistory.value.slice(0, limit);
  };

  return {
    // State
    testCases,
    activeTestCase,
    testResults,
    testHistory,
    loading,
    error,

    // Actions
    setLoading,
    setError,
    clearError,
    createTestCase,
    updateTestCase,
    deleteTestCase,
    executeToolTest,
    validateParameters,
    generateTestCaseTemplate,
    getTestCasesByTag,
    getTestCasesByTool,
    getRecentTestHistory,
  };
});
