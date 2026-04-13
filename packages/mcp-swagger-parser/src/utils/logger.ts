const DEBUG_ENABLED_VALUES = new Set(['1', 'true', 'yes', 'on', 'debug', 'verbose']);

function isEnabled(value?: string): boolean {
  return value ? DEBUG_ENABLED_VALUES.has(value.toLowerCase()) : false;
}

export function isParserDebugEnabled(explicit = false): boolean {
  if (explicit) {
    return true;
  }

  return (
    isEnabled(process.env.MCP_SWAGGER_DEBUG) ||
    isEnabled(process.env.MCP_SWAGGER_PARSER_DEBUG)
  );
}

export function parserDebugLog(message?: unknown, ...optionalParams: unknown[]): void {
  if (!isParserDebugEnabled()) {
    return;
  }

  console.error(message, ...optionalParams);
}

export function parserWarnLog(message?: unknown, ...optionalParams: unknown[]): void {
  if (!isParserDebugEnabled()) {
    return;
  }

  console.error(message, ...optionalParams);
}
