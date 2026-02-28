import { IncomingMessage, ServerResponse } from "http";
import http from "node:http";

const LOCAL_HOSTS = ["localhost", "127.0.0.1", "::1", "[::1]"] as const;

export interface HttpSecurityOptions {
  /**
   * Whether CORS headers should be emitted.
   * Defaults to true.
   */
  enableCors?: boolean;

  /**
   * Allowed Host header values (hostname only; port is ignored).
   */
  allowedHosts?: string[];

  /**
   * Allowed Origin header values.
   * Example: http://localhost:3000
   */
  allowedOrigins?: string[];

  /**
   * Enable DNS rebinding protection based on Host/Origin validation.
   * Defaults to true.
   */
  enableDnsRebindingProtection?: boolean;
}

export interface RequestHandlers {
  /**
   * Main handler for HTTP requests
   */
  handleRequest: (req: IncomingMessage, res: ServerResponse) => Promise<void>;

  /**
   * Custom cleanup function to be called when the server is shutting down
   */
  cleanup?: () => void;

  /**
   * Server type name for logging purposes
   */
  serverType: string;

  /**
   * Optional HTTP security settings.
   */
  security?: HttpSecurityOptions;
}

/**
 * Normalizes host values for safe host-header matching.
 */
function normalizeHostValue(host: string): string {
  const trimmed = host.trim().toLowerCase();

  if (!trimmed) {
    return trimmed;
  }

  const withoutProtocol = trimmed.replace(/^[a-z]+:\/\//, "");
  const firstSegment = withoutProtocol.split("/")[0];

  if (firstSegment.startsWith("[")) {
    const closingBracketIndex = firstSegment.indexOf("]");
    if (closingBracketIndex >= 0) {
      return firstSegment.slice(0, closingBracketIndex + 1);
    }
  }

  const colonCount = (firstSegment.match(/:/g) || []).length;
  if (colonCount > 1) {
    return firstSegment;
  }

  return firstSegment.split(":")[0];
}

function normalizeOriginValue(origin: string): string | undefined {
  try {
    const parsed = new URL(origin);
    return parsed.origin.toLowerCase();
  } catch (error) {
    console.error("Error parsing origin:", error);
    return undefined;
  }
}

function normalizeHostList(hosts: readonly string[] | undefined): Set<string> {
  if (!hosts || hosts.length === 0) {
    return new Set<string>();
  }

  const normalizedHosts = hosts
    .map((host) => normalizeHostValue(host))
    .filter((host) => host.length > 0);

  return new Set(normalizedHosts);
}

function normalizeOriginList(origins: readonly string[] | undefined): Set<string> {
  if (!origins || origins.length === 0) {
    return new Set<string>();
  }

  const normalizedOrigins = origins
    .map((origin) => normalizeOriginValue(origin))
    .filter((origin): origin is string => Boolean(origin));

  return new Set(normalizedOrigins);
}

interface EffectiveSecurityOptions {
  enableCors: boolean;
  enableDnsRebindingProtection: boolean;
  allowedHosts: Set<string>;
  allowedOrigins: Set<string>;
}

function buildEffectiveSecurityOptions(
  port: number,
  host: string,
  security?: HttpSecurityOptions
): EffectiveSecurityOptions {
  const normalizedListenHost = normalizeHostValue(host);
  const allowedHosts =
    security?.allowedHosts && security.allowedHosts.length > 0
      ? normalizeHostList(security.allowedHosts)
      : new Set<string>([normalizedListenHost, ...LOCAL_HOSTS.map((item) => normalizeHostValue(item))]);

  const allowedOrigins =
    security?.allowedOrigins && security.allowedOrigins.length > 0
      ? normalizeOriginList(security.allowedOrigins)
      : new Set<string>(
          Array.from(allowedHosts).flatMap((allowedHost) => {
            const hostValue = allowedHost === "::1" ? "[::1]" : allowedHost;
            return [`http://${hostValue}:${port}`, `https://${hostValue}:${port}`].map((origin) =>
              origin.toLowerCase()
            );
          })
        );

  return {
    enableCors: security?.enableCors !== false,
    enableDnsRebindingProtection: security?.enableDnsRebindingProtection !== false,
    allowedHosts,
    allowedOrigins,
  };
}

function isOriginAllowed(origin: string, security: EffectiveSecurityOptions): boolean {
  const normalizedOrigin = normalizeOriginValue(origin);
  if (!normalizedOrigin) {
    return false;
  }

  if (security.allowedOrigins.has(normalizedOrigin)) {
    return true;
  }

  const originHost = normalizeHostValue(normalizedOrigin);
  return security.allowedHosts.has(originHost);
}

/**
 * Handles CORS headers for incoming requests
 * @returns true when request origin is accepted, false otherwise.
 */
function handleCORS(
  req: IncomingMessage,
  res: ServerResponse,
  security: EffectiveSecurityOptions
): boolean {
  if (!security.enableCors) {
    return true;
  }

  const originHeader = req.headers.origin;
  if (!originHeader) {
    return true;
  }

  if (!isOriginAllowed(originHeader, security)) {
    return false;
  }

  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Origin", originHeader);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, Last-Event-ID, MCP-Session-Id"
  );

  return true;
}

function validateRequestHeaders(
  req: IncomingMessage,
  security: EffectiveSecurityOptions
): string | undefined {
  if (!security.enableDnsRebindingProtection) {
    return undefined;
  }

  const hostHeader = req.headers.host;
  if (!hostHeader) {
    return "Missing Host header";
  }

  const normalizedHost = normalizeHostValue(hostHeader);
  if (!security.allowedHosts.has(normalizedHost)) {
    return `Host header '${hostHeader}' is not allowed`;
  }

  const originHeader = req.headers.origin;
  if (originHeader && !isOriginAllowed(originHeader, security)) {
    return `Origin header '${originHeader}' is not allowed`;
  }

  return undefined;
}

/**
 * Handles common endpoints like health check and ping
 * @returns true if the request was handled, false otherwise
 */
function handleCommonEndpoints(
  req: IncomingMessage,
  res: ServerResponse
): boolean {
  //* check if the request has a url
  if (!req.url) {
    res.writeHead(400).end("No URL");
    return true;
  }
  let pathname: string;
  try {
    pathname = new URL(req.url, "http://localhost").pathname;
  } catch {
    res.writeHead(400).end("Invalid URL");
    return true;
  }
  //* health check endpoint
  if (req.method === "GET" && pathname === "/health") {
    res.writeHead(200, { "Content-Type": "text/plain" }).end("OK");
    return true;
  }
  //* ping endpoint
  if (req.method === "GET" && pathname === "/ping") {
    res.writeHead(200).end("pong");
    return true;
  }

  return false;
}

/**
 * Sets up signal handlers for graceful shutdown
 */
function setupCleanupHandlers(
  httpServer: http.Server,
  runCleanupOnce?: () => void
): void {
  const cleanup = () => {
    console.log("\nClosing server...");

    // Execute custom cleanup if provided
    if (runCleanupOnce) runCleanupOnce();

    httpServer.close(() => {
      console.log("Server closed");
      process.exit(0);
    });
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
}

/**
 * Logs server startup information with formatted URLs
 */
function logServerStartup(
  serverType: string,
  port: number,
  endpoint: string,
  host?: string
): void {
  const displayHost = host || "localhost";
  const serverUrl = `http://${displayHost}:${port}${endpoint}`;
  const healthUrl = `http://${displayHost}:${port}/health`;
  const pingUrl = `http://${displayHost}:${port}/ping`;

  console.log(
    `${serverType} running on: \x1b[32m\u001B[4m${serverUrl}\u001B[0m\x1b[0m`
  );
  console.log("\nTest endpoints:");
  console.log(`• Health check: \u001B[4m${healthUrl}\u001B[0m`);
  console.log(`• Ping test: \u001B[4m${pingUrl}\u001B[0m`);
}

export function createBaseHttpServer(
  port: number,
  endpoint: string,
  handlers: RequestHandlers,
  host?: string
): http.Server {
  const listenHost = host || "127.0.0.1";
  const security = buildEffectiveSecurityOptions(port, listenHost, handlers.security);

  let cleanedUp = false;
  const runCleanupOnce = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    if (handlers.cleanup) {
      handlers.cleanup();
    }
  };

  const httpServer = http.createServer(async (req, res) => {
    const headerValidationError = validateRequestHeaders(req, security);
    if (headerValidationError) {
      res.writeHead(403).end(headerValidationError);
      return;
    }

    // Handle CORS for all requests （跨域）
    const corsAllowed = handleCORS(req, res, security);
    if (!corsAllowed) {
      res.writeHead(403).end("CORS origin not allowed");
      return;
    }

    // Handle OPTIONS requests
    if (req.method === "OPTIONS") {
      res.writeHead(204).end();
      return;
    }

    // Handle common endpoints like health and ping （health check and ping test）
    if (handleCommonEndpoints(req, res)) return;

    // 生成接口
    try {
      await handlers.handleRequest(req, res);
    } catch (error) {
      console.error(`Error in ${handlers.serverType} request handler:`, error);
      res.writeHead(500).end("Internal Server Error");
    }
  });

  // Ensure custom cleanup also runs when server is closed programmatically.
  httpServer.once("close", () => {
    runCleanupOnce();
  });

  // Set up cleanup handlers
  setupCleanupHandlers(httpServer, runCleanupOnce);

  // Start listening and log server info
  httpServer.listen(port, listenHost, () => {
    logServerStartup(handlers.serverType, port, endpoint, listenHost);
  });

  return httpServer;
}
