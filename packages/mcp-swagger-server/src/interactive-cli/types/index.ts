import { OpenAPIV3 } from 'openapi-types';

/**
 * 操作过滤器 - 用于过滤 OpenAPI 操作
 */
export interface OperationFilter {
  methods?: {
    include?: string[];
    exclude?: string[];
  };
  paths?: {
    include?: string[];
    exclude?: string[];
  };
  operationIds?: {
    include?: string[];
    exclude?: string[];
  };
  tags?: {
    include?: string[];
    exclude?: string[];
  };
  customFilter?: (operation: OpenAPIV3.OperationObject, method: string, path: string) => boolean;
}

/**
 * 接口选择模式
 */
export type InterfaceSelectionMode = 'include' | 'exclude' | 'tags' | 'patterns';

/**
 * 认证配置
 */
export interface AuthConfig {
  type: 'bearer' | 'basic' | 'apikey';
  token?: string;
  username?: string;
  password?: string;
  apiKey?: string;
  apiKeyHeader?: string;
  headerName?: string;
}

/**
 * 接口选择配置
 */
export interface InterfaceSelectionConfig {
  mode: InterfaceSelectionMode;
  selectedEndpoints?: string[];
  selectedTags?: string[];
  pathPatterns?: string[];
  operationFilter?: OperationFilter;
}

/**
 * 会话配置
 */
export interface SessionConfig {
  id: string;
  name: string;
  description?: string;
  openApiUrl: string;
  transport: 'stdio' | 'sse' | 'streamable';
  port?: number;
  host?: string;
  operationFilter?: OperationFilter;
  auth?: AuthConfig;
  customHeaders?: Record<string, string>;
  interfaceSelection?: InterfaceSelectionConfig;
  createdAt: string;
  lastUsed: string;
}

/**
 * 向导步骤状态
 */
export interface WizardStepState {
  completed: boolean;
  data?: any;
  error?: string;
}

/**
 * 向导状态
 */
export interface WizardState {
  currentStep: number;
  totalSteps: number;
  stepStates: Record<string, WizardStepState>;
  canGoBack: boolean;
  canGoForward: boolean;
}

export interface WizardContext {
  sessionConfig: Partial<SessionConfig>;
  wizardState: WizardState;
  data: any;
  currentStep?: number;
  steps?: any[];
  isEditing?: boolean;
}

export type TransportType = 'stdio' | 'sse' | 'streamable';

export interface OpenAPIValidationResult {
  valid: boolean;
  errors?: string[];
  warnings?: string[];
  title?: string;
  version?: string;
  operationCount?: number;
  description?: string;
}

export interface PresetOpenAPIUrl {
  name: string;
  url: string;
  description?: string;
  category?: string;
}