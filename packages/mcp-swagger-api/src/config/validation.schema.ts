import * as Joi from 'joi';

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().port().default(3001),
  MCP_PORT: Joi.number().port().default(3322),

  CORS_ORIGINS: Joi.string().default(
    'http://localhost:5173,http://localhost:3000,http://127.0.0.1:3000',
  ),

  DB_TYPE: Joi.string().valid('sqlite', 'postgres').default('sqlite'),
  DB_SQLITE_PATH: Joi.string().default('data/mcp-swagger.db'),
  DB_HOST: Joi.string().default('localhost'),
  DB_PORT: Joi.number().port().default(5432),
  DB_USERNAME: Joi.string().default('postgres'),
  DB_PASSWORD: Joi.string().default('password'),
  DB_DATABASE: Joi.string().default('mcp_swagger_api'),
  DB_LOGGING: Joi.boolean().default(false),
  DB_SYNCHRONIZE: Joi.boolean().optional(),

  API_KEY: Joi.string().optional(),
  JWT_SECRET: Joi.string().optional(),

  LOG_LEVEL: Joi.string()
    .valid('error', 'warn', 'info', 'debug', 'verbose')
    .default('info'),
  LOG_FORMAT: Joi.string()
    .valid('json', 'pretty')
    .default('pretty'),
  PROCESS_LOG_PERSIST_ENABLED: Joi.boolean().default(true),
  PROCESS_LOG_PERSIST_MIN_INTERVAL_MS: Joi.number().min(0).default(1000),
  PROCESS_LOG_MAX_MESSAGE_LENGTH: Joi.number().positive().default(4000),
  PROCESS_LOG_RETENTION_DAYS: Joi.number().positive().default(7),
  SYSTEM_LOG_RETENTION_DAYS: Joi.number().positive().default(14),
  HEALTH_CHECK_RETENTION_DAYS: Joi.number().positive().default(7),
  HEALTH_CHECK_PERSIST_INTERVAL_MS: Joi.number().min(0).default(60000),

  REQUEST_TIMEOUT: Joi.number().positive().default(30000),
  CACHE_TTL: Joi.number().positive().default(300),
  MAX_PAYLOAD_SIZE: Joi.string().default('10mb'),

  MCP_SERVER_HOST: Joi.string().default('localhost'),
  MCP_SERVER_PORT: Joi.number().port().default(3322),
  MCP_SERVER_HEALTH_CHECK_INTERVAL: Joi.number().positive().default(30000),

  DEFAULT_OPENAPI_BASE_URL: Joi.string().uri().optional(),
  MAX_OPENAPI_FILE_SIZE: Joi.string().default('5mb'),
  OPENAPI_CACHE_TTL: Joi.number().positive().default(600),

  METRICS_ENABLED: Joi.boolean().default(true),
  HEALTH_CHECK_ENABLED: Joi.boolean().default(true),
  HEALTH_CHECK_TIMEOUT: Joi.number().positive().default(5000),

  HOT_RELOAD: Joi.boolean().default(false),
  WATCH_FILES: Joi.boolean().default(false),
  DEBUG_MODE: Joi.boolean().default(false),
});
