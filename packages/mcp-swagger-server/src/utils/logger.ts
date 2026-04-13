const DEBUG_ENABLED_VALUES = new Set(['1', 'true', 'yes', 'on', 'debug', 'verbose']);

function isEnabled(value?: string): boolean {
  return value ? DEBUG_ENABLED_VALUES.has(value.toLowerCase()) : false;
}

export function isServerDebugEnabled(explicit = false): boolean {
  if (explicit) {
    return true;
  }

  return (
    isEnabled(process.env.MCP_SWAGGER_DEBUG) ||
    isEnabled(process.env.MCP_SWAGGER_SERVER_DEBUG)
  );
}

export function serverDebugLog(message?: unknown, ...optionalParams: unknown[]): void {
  if (!isServerDebugEnabled()) {
    return;
  }

  console.error(message, ...optionalParams);
}

export function serverWarnLog(message?: unknown, ...optionalParams: unknown[]): void {
  if (!isServerDebugEnabled()) {
    return;
  }

  console.error(message, ...optionalParams);
}
