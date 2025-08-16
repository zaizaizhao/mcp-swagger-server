import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
    type EventStore,
    StreamableHTTPServerTransport,
  } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { InMemoryEventStore } from "../tools/InMemoryEventStore";
import { randomUUID } from "node:crypto";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import type { IncomingMessage, ServerResponse, Server } from "node:http";
import { createBaseHttpServer, RequestHandlers } from "../tools/httpServer";
import { getBody } from "../tools/getBody";
import { EventEmitter } from "node:events";

// MCP连接监控相关接口
interface ClientConnection {
  sessionId: string;
  remoteAddress?: string;
  userAgent?: string;
  connectedAt: Date;
  transport: any;
}

interface ConnectionStats {
  totalConnections: number;
  activeConnections: number;
}

interface MCPConnectionEvent {
  type: 'MCP_CONNECTION_EVENT';
  eventType: 'connected' | 'disconnected' | 'stats_update';
  clientInfo?: {
    sessionId: string;
    remoteAddress?: string;
    userAgent?: string;
    connectedAt: Date;
  };
  connectionStats: ConnectionStats;
  timestamp: Date;
}

// MCP连接监控器 - 利用现有的stdout输出机制
class MCPConnectionMonitor extends EventEmitter {
  private connections = new Map<string, ClientConnection>();
  private serverId: string;

  constructor(serverId?: string) {
    super();
    this.serverId = serverId || 'mcp-server';
  }

  // 添加连接 - 使用sessionId作为唯一标识
  addConnection(sessionId: string, transport: any, req?: IncomingMessage): void {
    const connection: ClientConnection = {
      sessionId,
      remoteAddress: this.extractRemoteAddress(transport, req),
      userAgent: this.extractUserAgent(transport, req),
      connectedAt: new Date(),
      transport
    };

    this.connections.set(sessionId, connection);
    this.logConnectionEvent('connected', connection);
  }

  // 移除连接
  removeConnection(sessionId: string): void {
    const connection = this.connections.get(sessionId);
    if (connection) {
      this.connections.delete(sessionId);
      this.logConnectionEvent('disconnected', connection);
    }
  }

  // 获取连接统计
  getConnectionStats(): { totalConnections: number; activeConnections: any[] } {
    return {
      totalConnections: this.connections.size,
      activeConnections: Array.from(this.connections.values()).map(conn => ({
        sessionId: conn.sessionId,
        remoteAddress: conn.remoteAddress,
        userAgent: conn.userAgent,
        connectedAt: conn.connectedAt
      }))
    };
  }

  // 通过console.log发送结构化日志 - 利用现有的setupProcessOutputMonitoring
  private logConnectionEvent(eventType: 'connected' | 'disconnected', connection: ClientConnection): void {
    const logEntry: MCPConnectionEvent = {
      type: 'MCP_CONNECTION_EVENT',
      eventType,
      clientInfo: {
        sessionId: connection.sessionId,
        remoteAddress: connection.remoteAddress,
        userAgent: connection.userAgent,
        connectedAt: connection.connectedAt
      },
      connectionStats: {
        totalConnections: this.connections.size,
        activeConnections: this.connections.size
      },
      timestamp: new Date()
    };

    // 发送到stdout - 会被API进程的setupProcessOutputMonitoring捕获
    console.log(`[MCP_CONNECTION] ${JSON.stringify(logEntry)}`);
    
    this.emit('connectionChange', logEntry);
  }

  // 定期发送连接统计
  startStatsReporting(intervalMs: number = 5000): NodeJS.Timeout {
    return setInterval(() => {
      const stats = this.getConnectionStats();
      const logEntry: MCPConnectionEvent = {
        type: 'MCP_CONNECTION_EVENT',
        eventType: 'stats_update',
        connectionStats: {
          totalConnections: stats.totalConnections,
          activeConnections: stats.totalConnections
        },
        timestamp: new Date()
      };
      
      console.log(`[MCP_CONNECTION] ${JSON.stringify(logEntry)}`);
    }, intervalMs);
  }

  private extractRemoteAddress(transport: any, req?: IncomingMessage): string | undefined {
    // 优先从请求对象中获取
    if (req && req.socket) {
      return req.socket.remoteAddress || req.headers['x-forwarded-for'] as string || req.headers['x-real-ip'] as string;
    }
    // 备用：从transport中获取
    if (transport && transport.socket) {
      return transport.socket.remoteAddress;
    }
    return undefined;
  }

  private extractUserAgent(transport: any, req?: IncomingMessage): string | undefined {
    // 优先从请求对象中获取
    if (req && req.headers) {
      return req.headers['user-agent'];
    }
    // 备用：从transport中获取
    if (transport && transport.headers) {
      return transport.headers['user-agent'];
    }
    return undefined;
  }
}

// 全局连接监控器实例
const globalConnectionMonitor = new MCPConnectionMonitor();

export async function startStreamableMcpServer(server: McpServer, endpoint: string, port: number,eventStore: EventStore = new InMemoryEventStore(),): Promise<Server> {
    const activeTransports: Record<
    string,
    {
      server: McpServer;
      transport: StreamableHTTPServerTransport;
      isClosing?: boolean;
    }
  > = {};

  const handleRequest: RequestHandlers["handleRequest"] = async (
    req: IncomingMessage,
    res: ServerResponse,
  ) => {
    if (!req.url) {
      res.writeHead(400).end("No URL");
      return;
    }

    const reqUrl = new URL(req.url, "http://localhost");

    // Handle POST requests to endpoint
    if (req.method === "POST" && reqUrl.pathname === endpoint) {
      try {
        const sessionId = Array.isArray(req.headers["mcp-session-id"])
          ? req.headers["mcp-session-id"][0]
          : req.headers["mcp-session-id"];
        let transport: StreamableHTTPServerTransport;


        const body = await getBody(req);

        /**
         * diagram: https://modelcontextprotocol.io/specification/2025-03-26/basic/transports#sequence-diagram.
         */
        // 1. If the sessionId is provided and the server is already created, use the existing transport and server.
        if (sessionId && activeTransports[sessionId]) {
          transport = activeTransports[sessionId].transport;
          server = activeTransports[sessionId].server;

          // 2. If the sessionId is not provided and the request is an initialize request, create a new transport for the session.
        } else if (!sessionId && isInitializeRequest(body)) {
          transport = new StreamableHTTPServerTransport({
            // use the event store to store the events to replay on reconnect.
            // more details: https://modelcontextprotocol.io/specification/2025-03-26/basic/transports#resumability-and-redelivery.
            eventStore: eventStore || new InMemoryEventStore(),
            onsessioninitialized: (_sessionId: string) => {
              // add only when the id Sesison id is generated.
              activeTransports[_sessionId] = {
                server,
                transport,
                isClosing: false,
              };
              
              // 添加MCP连接监控 - 使用sessionId作为唯一标识
              globalConnectionMonitor.addConnection(_sessionId, transport, req);
            },
            sessionIdGenerator: randomUUID,
          });

          // Handle the server close event.
          transport.onclose = async () => {
            console.log("transport onclose",JSON.stringify(transport));

            const sid = transport.sessionId;
            if (sid && activeTransports[sid] && !activeTransports[sid].isClosing) {
              activeTransports[sid].isClosing = true;
              try {
                // 移除MCP连接监控 - 使用sessionId
                globalConnectionMonitor.removeConnection(sid);
                
                await server?.close();
              } catch (error) {
                console.error("Error closing server:", error);
              } finally {
                // delete used transport and server to avoid memory leak.
                delete activeTransports[sid];
              }
            }
          };


          server.connect(transport);

          await transport.handleRequest(req, res, body);
          return;
        } else {
          // Error if the server is not created but the request is not an initialize request.
          res.setHeader("Content-Type", "application/json");
          res.writeHead(400).end(
            JSON.stringify({
              error: {
                code: -32000,
                message: "Bad Request: No valid session ID provided",
              },
              id: null,
              jsonrpc: "2.0",
            }),
          );

          return;
        }

        // Handle the request if the server is already created.
        await transport.handleRequest(req, res, body);
      } catch (error) {
        console.error("Error handling request:", error);
        res.setHeader("Content-Type", "application/json");
        res.writeHead(500).end(
          JSON.stringify({
            error: { code: -32603, message: "Internal Server Error" },
            id: null,
            jsonrpc: "2.0",
          }),
        );
      }
      return;
    }

    // Handle GET requests to endpoint
    if (req.method === "GET" && reqUrl.pathname === endpoint) {
      const sessionId = req.headers["mcp-session-id"] as string | undefined;
      const activeTransport:
        | {
            server: McpServer;
            transport: StreamableHTTPServerTransport;
          }
        | undefined = sessionId ? activeTransports[sessionId] : undefined;

      if (!sessionId) {
        res.writeHead(400).end("No sessionId");
        return;
      }

      if (!activeTransport) {
        res.writeHead(400).end("No active transport");
        return;
      }

      const lastEventId = req.headers["last-event-id"] as string | undefined;
      if (lastEventId) {
        console.log(`Client reconnecting with Last-Event-ID: ${lastEventId}`);
      } else {
        console.log(`Establishing new connection for session ${sessionId}`);
      }
      //* 重连机制由SDK实现
      await activeTransport.transport.handleRequest(req, res);
      return;
    }

    // Handle DELETE requests to endpoint
    if (req.method === "DELETE" && reqUrl.pathname === endpoint) {
      console.log("received delete request");
      const sessionId = req.headers["mcp-session-id"] as string | undefined;
      if (!sessionId) {
        res.writeHead(400).end("Invalid or missing sessionId");
        return;
      }

      console.log("received delete request for session", sessionId);

      const activeTransport = activeTransports[sessionId];
      if (!activeTransport) {
        res.writeHead(400).end("No active transport");
        return;
      }

      try {
        if (!activeTransport.isClosing) {
          activeTransport.isClosing = true;
          // 在处理DELETE请求前，先移除连接监控
          globalConnectionMonitor.removeConnection(sessionId);
          
          await activeTransport.transport.handleRequest(req, res);
          
          // 清理activeTransports
          try {
            await activeTransport.server?.close();
          } catch (error) {
            console.error("Error closing server on DELETE:", error);
          } finally {
            delete activeTransports[sessionId];
          }
        }
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
    for (const [sessionId, { server, transport }] of Object.entries(activeTransports)) {
      try {
        if (!activeTransports[sessionId].isClosing) {
          activeTransports[sessionId].isClosing = true;
          transport.close();
          server.close();
        }
      } catch (error) {
        console.error(`Error closing transport/server for session ${sessionId}:`, error);
      }
    }
  };

  // 启动MCP连接统计报告
  const statsInterval = globalConnectionMonitor.startStatsReporting();

  // Create the HTTP server using our factory
  const httpServer = createBaseHttpServer(port, endpoint, {
    handleRequest,
    cleanup: () => {
      // 清理统计报告定时器
      clearInterval(statsInterval);
      // 执行原有的清理逻辑
      cleanup();
    },
    serverType: "HTTP Streamable Server",
  });
  httpServer.on("close", () => {
    console.log("HTTP server closed");

  });
    // const transport = new StreamableServerTransport();
    // await server.connect(transport);
    
    return httpServer;
}
