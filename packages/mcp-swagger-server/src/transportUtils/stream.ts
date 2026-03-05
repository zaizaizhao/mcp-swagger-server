import { EventEmitter } from "node:events";
import type { IncomingMessage, ServerResponse, Server } from "node:http";
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  type EventStore,
  StreamableHTTPServerTransport,
} from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest, type JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import { InMemoryEventStore } from "../tools/InMemoryEventStore";
import {
  createBaseHttpServer,
  type HttpSecurityOptions,
  type RequestHandlers,
} from "../tools/httpServer";
import { getBody } from "../tools/getBody";

type StreamableServerFactory = () => Promise<McpServer>;
type StreamableServerSource = McpServer | StreamableServerFactory;

interface StreamableSessionContext {
  server: McpServer;
  transport: StreamableHTTPServerTransport;
  isClosing: boolean;
}

interface ActiveConnectionInfo {
  sessionId: string;
  remoteAddress?: string;
  userAgent?: string;
  connectedAt: Date;
}

interface ConnectionStats {
  totalConnections: number;
  activeConnections: number;
}

interface MCPConnectionEvent {
  type: "MCP_CONNECTION_EVENT";
  eventType: "connected" | "disconnected" | "stats_update";
  clientInfo?: ActiveConnectionInfo;
  connectionStats: ConnectionStats;
  timestamp: Date;
}

export interface StreamableMcpServerOptions extends HttpSecurityOptions {
  eventStore?: EventStore;
  host?: string;
}

function getHeaderValue(
  req: IncomingMessage,
  headerName: string
): string | undefined {
  const headerValue = req.headers[headerName];
  if (Array.isArray(headerValue)) {
    return headerValue[0];
  }
  return headerValue;
}

function isServerFactory(serverSource: StreamableServerSource): serverSource is StreamableServerFactory {
  return typeof serverSource === "function";
}

// MCP连接监控器 - 利用现有的stdout输出机制
export class MCPConnectionMonitor extends EventEmitter {
  private readonly connections = new Map<string, ActiveConnectionInfo>();
  private lastStatsHash = "";
  private readonly debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

  // 添加连接 - 使用sessionId作为唯一标识
  addConnection(sessionId: string, req?: IncomingMessage): void {
    const connection: ActiveConnectionInfo = {
      sessionId,
      remoteAddress: this.extractRemoteAddress(req),
      userAgent: this.extractUserAgent(req),
      connectedAt: new Date(),
    };

    this.connections.set(sessionId, connection);
    this.logConnectionEvent("connected", connection);
  }

  // 移除连接
  removeConnection(sessionId: string): void {
    const connection = this.connections.get(sessionId);
    if (!connection) {
      return;
    }

    this.connections.delete(sessionId);
    this.logConnectionEvent("disconnected", connection);
  }

  // 获取连接统计
  getConnectionStats(): {
    totalConnections: number;
    activeConnections: ActiveConnectionInfo[];
  } {
    return {
      totalConnections: this.connections.size,
      activeConnections: Array.from(this.connections.values()),
    };
  }

  // 通过console.log发送结构化日志 - 利用现有的setupProcessOutputMonitoring，添加防抖机制
  private logConnectionEvent(
    eventType: "connected" | "disconnected",
    connection: ActiveConnectionInfo
  ): void {
    const debounceKey = `${eventType}_${connection.sessionId}`;
    const previousTimer = this.debounceTimers.get(debounceKey);
    if (previousTimer) {
      clearTimeout(previousTimer);
    }

    const timer = setTimeout(() => {
      const logEntry: MCPConnectionEvent = {
        type: "MCP_CONNECTION_EVENT",
        eventType,
        clientInfo: connection,
        connectionStats: {
          totalConnections: this.connections.size,
          activeConnections: this.connections.size,
        },
        timestamp: new Date(),
      };

      console.log(`[MCP_CONNECTION] ${JSON.stringify(logEntry)}`);
      this.emit("connectionChange", logEntry);
      this.debounceTimers.delete(debounceKey);
    }, 500);

    this.debounceTimers.set(debounceKey, timer);
  }

  // 定期发送连接统计 - 增加推送间隔到60秒并添加去重机制
  startStatsReporting(intervalMs = 60_000): ReturnType<typeof setInterval> {
    return setInterval(() => {
      const stats = this.getConnectionStats();
      const logEntry: MCPConnectionEvent = {
        type: "MCP_CONNECTION_EVENT",
        eventType: "stats_update",
        connectionStats: {
          totalConnections: stats.totalConnections,
          activeConnections: stats.totalConnections,
        },
        timestamp: new Date(),
      };

      const statsHash = this.calculateStatsHash(logEntry.connectionStats);
      if (statsHash !== this.lastStatsHash) {
        this.lastStatsHash = statsHash;
        console.log(`[MCP_CONNECTION] ${JSON.stringify(logEntry)}`);
      }
    }, intervalMs);
  }

  // 计算统计数据哈希值用于去重
  private calculateStatsHash(stats: ConnectionStats): string {
    return JSON.stringify(stats);
  }

  private extractRemoteAddress(req?: IncomingMessage): string | undefined {
    if (!req) {
      return undefined;
    }

    const forwardedFor = req.headers["x-forwarded-for"];
    const realIp = req.headers["x-real-ip"];
    const firstForwarded = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
    const firstRealIp = Array.isArray(realIp) ? realIp[0] : realIp;

    return req.socket.remoteAddress || firstForwarded || firstRealIp;
  }

  private extractUserAgent(req?: IncomingMessage): string | undefined {
    if (!req) {
      return undefined;
    }

    const userAgent = req.headers["user-agent"];
    return Array.isArray(userAgent) ? userAgent[0] : userAgent;
  }
}

// 全局连接监控器实例
const globalConnectionMonitor = new MCPConnectionMonitor();

export async function startStreamableMcpServer(
  serverSource: StreamableServerSource,
  endpoint: string,
  port: number,
  options: StreamableMcpServerOptions = {}
): Promise<Server> {
  const activeSessions: Record<string, StreamableSessionContext> = {};
  const sessionEventStore = options.eventStore ?? new InMemoryEventStore();
  const useServerFactory = isServerFactory(serverSource);

  const createSessionServer = async (): Promise<McpServer> => {
    if (useServerFactory) {
      return serverSource();
    }

    if (Object.keys(activeSessions).length > 0) {
      throw new Error(
        "Single McpServer instance only supports one active Streamable HTTP session. Use a server factory to enable multi-session safely."
      );
    }

    return serverSource;
  };

  const closeSession = async (sessionId: string): Promise<void> => {
    const session = activeSessions[sessionId];
    if (!session || session.isClosing) {
      return;
    }

    session.isClosing = true;
    globalConnectionMonitor.removeConnection(sessionId);

    try {
      await session.transport.close();
    } catch (error) {
      console.error(`Error closing transport for session ${sessionId}:`, error);
    }

    try {
      await session.server.close();
    } catch (error) {
      console.error(`Error closing server for session ${sessionId}:`, error);
    }

    delete activeSessions[sessionId];
  };

  const handleRequest: RequestHandlers["handleRequest"] = async (
    req: IncomingMessage,
    res: ServerResponse
  ) => {
    if (!req.url) {
      res.writeHead(400).end("No URL");
      return;
    }

    const reqUrl = new URL(req.url, "http://localhost");

    // Handle POST requests to endpoint
    if (req.method === "POST" && reqUrl.pathname === endpoint) {
      try {
        const sessionId = getHeaderValue(req, "mcp-session-id");
        const body = await getBody<JSONRPCMessage>(req);

        // 1. If the sessionId is provided and a session exists, reuse it.
        if (sessionId) {
          const activeSession = activeSessions[sessionId];
          if (!activeSession) {
            res.writeHead(404).end("No active transport");
            return;
          }

          await activeSession.transport.handleRequest(req, res, body);
          return;
        }

        // 2. If this is an initialize request, create a new isolated session server.
        if (!isInitializeRequest(body)) {
          res.setHeader("Content-Type", "application/json");
          res.writeHead(400).end(
            JSON.stringify({
              error: {
                code: -32000,
                message: "Bad Request: No valid session ID provided",
              },
              id: null,
              jsonrpc: "2.0",
            })
          );
          return;
        }

        const sessionServer = await createSessionServer();
        let transport: StreamableHTTPServerTransport;
        transport = new StreamableHTTPServerTransport({
          eventStore: sessionEventStore,
          sessionIdGenerator: randomUUID,
          enableDnsRebindingProtection:
            options.enableDnsRebindingProtection !== false,
          allowedHosts: options.allowedHosts,
          allowedOrigins: options.allowedOrigins,
          onsessioninitialized: (initializedSessionId: string) => {
            activeSessions[initializedSessionId] = {
              server: sessionServer,
              transport,
              isClosing: false,
            };
            globalConnectionMonitor.addConnection(initializedSessionId, req);
          },
          onsessionclosed: async (closedSessionId: string) => {
            await closeSession(closedSessionId);
          },
        });

        transport.onclose = async () => {
          if (transport.sessionId) {
            await closeSession(transport.sessionId);
          }
        };

        await sessionServer.connect(transport);
        await transport.handleRequest(req, res, body);
      } catch (error) {
        console.error("Error handling request:", error);
        res.setHeader("Content-Type", "application/json");
        res.writeHead(500).end(
          JSON.stringify({
            error: { code: -32603, message: "Internal Server Error" },
            id: null,
            jsonrpc: "2.0",
          })
        );
      }
      return;
    }

    // Handle GET requests to endpoint
    if (req.method === "GET" && reqUrl.pathname === endpoint) {
      const sessionId = getHeaderValue(req, "mcp-session-id");
      if (!sessionId) {
        res.writeHead(400).end("No sessionId");
        return;
      }

      const activeSession = activeSessions[sessionId];
      if (!activeSession) {
        res.writeHead(404).end("No active transport");
        return;
      }

      const lastEventId = getHeaderValue(req, "last-event-id");
      if (lastEventId) {
        console.log(`Client reconnecting with Last-Event-ID: ${lastEventId}`);
      } else {
        console.log(`Establishing new connection for session ${sessionId}`);
      }

      await activeSession.transport.handleRequest(req, res);
      return;
    }

    // Handle DELETE requests to endpoint
    if (req.method === "DELETE" && reqUrl.pathname === endpoint) {
      const sessionId = getHeaderValue(req, "mcp-session-id");
      if (!sessionId) {
        res.writeHead(400).end("Invalid or missing sessionId");
        return;
      }

      const activeSession = activeSessions[sessionId];
      if (!activeSession) {
        res.writeHead(404).end("No active transport");
        return;
      }

      try {
        await activeSession.transport.handleRequest(req, res);
        await closeSession(sessionId);
      } catch (error) {
        console.error("Error handling delete request:", error);
        res.writeHead(500).end("Error handling delete request");
      }
      return;
    }

    // If we reach here, no handler matched
    res.writeHead(404).end("Not found");
  };

  const cleanup = () => {
    for (const sessionId of Object.keys(activeSessions)) {
      void closeSession(sessionId);
    }
  };

  // 启动MCP连接统计报告
  const statsInterval = globalConnectionMonitor.startStatsReporting();

  // Create the HTTP server using our factory
  return createBaseHttpServer(
    port,
    endpoint,
    {
      handleRequest,
      cleanup: () => {
        clearInterval(statsInterval);
        cleanup();
      },
      serverType: "HTTP Streamable Server",
      security: {
        enableDnsRebindingProtection: options.enableDnsRebindingProtection,
        allowedHosts: options.allowedHosts,
        allowedOrigins: options.allowedOrigins,
      },
    },
    options.host
  );
}
