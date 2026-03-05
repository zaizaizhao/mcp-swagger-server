import * as fs from 'fs';
import { ServerOptions, ConfigFile } from './types';

export function extractCustomHeadersFromEnv(envVars: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = {};
  const prefix = 'MCP_CUSTOM_HEADERS_';
  
  // Priority: .env file > system env (so .env values override system env)
  const allEnvVars = { ...process.env, ...envVars };
  
  for (const [key, value] of Object.entries(allEnvVars)) {
    if (key.startsWith(prefix) && value) {
      const headerName = key.substring(prefix.length).replace(/_/g, '-');
      headers[headerName] = value;
    }
  }
  
  return headers;
}

export function parseCustomHeaders(
  options: ServerOptions & {
    'custom-header'?: string[];
    header?: string[];
    'custom-headers-config'?: string;
    'custom-header-env'?: string[];
  },
  config?: ConfigFile,
  envVars?: Record<string, string>
): any | undefined {
  const customHeaders: any = {};
  let hasConfig = false;
  const parseHeaderPair = (raw: string): { key: string; value: string } | null => {
    const trimmed = raw.trim();
    if (!trimmed) return null;

    const eqIndex = trimmed.indexOf('=');
    if (eqIndex > 0) {
      return {
        key: trimmed.slice(0, eqIndex).trim(),
        value: trimmed.slice(eqIndex + 1).trim()
      };
    }

    // Backward-compatible syntax: Key:Value
    const colonIndex = trimmed.indexOf(':');
    if (colonIndex > 0) {
      return {
        key: trimmed.slice(0, colonIndex).trim(),
        value: trimmed.slice(colonIndex + 1).trim()
      };
    }

    return null;
  };

  if (config?.customHeaders) {
    Object.assign(customHeaders, config.customHeaders);
    hasConfig = true;
  }

  if (options['custom-headers-config']) {
    try {
      const configFile = JSON.parse(fs.readFileSync(options['custom-headers-config'], 'utf8'));
      Object.assign(customHeaders, configFile);
      hasConfig = true;
    } catch (error: any) {
      console.error(`Error loading custom headers config: ${error.message}`);
    }
  }

  const staticHeaderArgs = [...(options['custom-header'] || []), ...(options.header || [])];
  if (staticHeaderArgs.length > 0) {
    if (!customHeaders.static) customHeaders.static = {};
    
    for (const header of staticHeaderArgs) {
      const pair = parseHeaderPair(header);
      if (pair?.key && pair.value) {
        customHeaders.static[pair.key] = pair.value;
        hasConfig = true;
      }
    }
  }

  if (options['custom-header-env']) {
    if (!customHeaders.env) customHeaders.env = {};
    
    for (const header of options['custom-header-env']) {
      const [key, envName] = header.split('=', 2);
      if (key && envName) {
        customHeaders.env[key] = envName;
        hasConfig = true;
      }
    }
  }

  const customHeadersFromEnv = extractCustomHeadersFromEnv(envVars);
  if (Object.keys(customHeadersFromEnv).length > 0) {
    if (!customHeaders.static) customHeaders.static = {};
    Object.assign(customHeaders.static, customHeadersFromEnv);
    hasConfig = true;
  }

  return hasConfig ? customHeaders : undefined;
}
