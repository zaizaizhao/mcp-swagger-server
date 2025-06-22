import * as Joi from 'joi';

export const validationSchema = Joi.object({
  // 应用配置
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().port().default(3001),
  MCP_PORT: Joi.number().port().default(3322),

  // CORS配置
  CORS_ORIGINS: Joi.string().default('http://localhost:5173'),

  // 安全配置
  API_KEY: Joi.string().optional(),
  JWT_SECRET: Joi.string().optional(),

  // 日志配置
  LOG_LEVEL: Joi.string()
    .valid('error', 'warn', 'info', 'debug', 'verbose')
    .default('info'),
  LOG_FORMAT: Joi.string()
    .valid('json', 'pretty')
    .default('pretty'),

  // 性能配置
  REQUEST_TIMEOUT: Joi.number().positive().default(30000),
  CACHE_TTL: Joi.number().positive().default(300),
  MAX_PAYLOAD_SIZE: Joi.string().default('10mb'),

  // MCP Server配置
  MCP_SERVER_HOST: Joi.string().default('localhost'),
  MCP_SERVER_PORT: Joi.number().port().default(3322),
  MCP_SERVER_HEALTH_CHECK_INTERVAL: Joi.number().positive().default(30000),

  // OpenAPI配置
  DEFAULT_OPENAPI_BASE_URL: Joi.string().uri().optional(),
  MAX_OPENAPI_FILE_SIZE: Joi.string().default('5mb'),
  OPENAPI_CACHE_TTL: Joi.number().positive().default(600),

  // 监控配置
  METRICS_ENABLED: Joi.boolean().default(true),
  HEALTH_CHECK_ENABLED: Joi.boolean().default(true),
  HEALTH_CHECK_TIMEOUT: Joi.number().positive().default(5000),

  // 开发配置
  HOT_RELOAD: Joi.boolean().default(false),
  WATCH_FILES: Joi.boolean().default(false),
  DEBUG_MODE: Joi.boolean().default(false),
});
