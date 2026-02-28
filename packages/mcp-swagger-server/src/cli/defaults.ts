export const CLI_DEFAULTS = {
  transport: 'stdio' as const,
  port: 3322,
  host: '127.0.0.1',
  maxRetries: 5,
  retryDelay: 5000,
  serverTimeout: 30000,
  logLevel: 'info' as const,
  authType: 'none' as const,
  bearerEnvName: 'API_TOKEN',
  dnsRebindingProtection: true,
} as const;

export type TransportType = 'stdio' | 'sse' | 'streamable';
export type LogLevel = 'error' | 'warn' | 'info' | 'debug';
export type AuthType = 'none' | 'bearer';
