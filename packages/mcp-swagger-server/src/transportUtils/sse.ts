import type { IncomingMessage, Server as HttpServer, ServerResponse } from "http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  createBaseHttpServer,
  type HttpSecurityOptions,
  type RequestHandlers,
} from "../tools/httpServer";

type SseServerFactory = () => Promise<McpServer>;
type SseServerSource = McpServer | SseServerFactory;

interface SseSessionContext {
  server: McpServer;
  transport: SSEServerTransport;
}

export interface SseMcpServerOptions extends HttpSecurityOptions {
  host?: string;
}

function isServerFactory(serverSource: SseServerSource): serverSource is SseServerFactory {
  return typeof serverSource === "function";
}

function closeSession(activeSession?: SseSessionContext): void {
  if (!activeSession) {
    return;
  }

  try {
    activeSession.transport.close();
  } catch (error) {
    console.error("Error closing SSE transport:", error);
  }

  void activeSession.server.close().catch((error) => {
    console.error("Error closing SSE server:", error);
  });
}

export async function startSseMcpServer(
  serverSource: SseServerSource,
  endpoint: string,
  port: number,
  options: SseMcpServerOptions = {}
): Promise<HttpServer> {
  const activeSessions: Record<string, SseSessionContext> = {};
  const useServerFactory = isServerFactory(serverSource);

  const createSessionServer = async (): Promise<McpServer> => {
    if (useServerFactory) {
      return serverSource();
    }

    if (Object.keys(activeSessions).length > 0) {
      throw new Error(
        "Single McpServer instance only supports one active SSE session. Use a server factory to enable multi-session safely."
      );
    }

    return serverSource;
  };

  const messagesEndpoint = endpoint.endsWith("/")
    ? `${endpoint}messages`
    : `${endpoint}/messages`;

  const handleRequest: RequestHandlers["handleRequest"] = async (
    req: IncomingMessage,
    res: ServerResponse
  ) => {
    if (!req.url) {
      res.writeHead(400).end("No URL");
      return;
    }

    const reqUrl = new URL(req.url, "http://localhost");

    // Handle GET requests to the SSE endpoint
    if (req.method === "GET" && reqUrl.pathname === endpoint) {
      const sessionServer = await createSessionServer();
      const transport = new SSEServerTransport(messagesEndpoint, res);
      const sessionId = transport.sessionId;

      activeSessions[sessionId] = {
        server: sessionServer,
        transport,
      };

      let closed = false;

      res.on("close", () => {
        closed = true;
        const activeSession = activeSessions[sessionId];
        delete activeSessions[sessionId];
        closeSession(activeSession);
      });

      try {
        await sessionServer.connect(transport);
        await transport.send({
          jsonrpc: "2.0",
          method: "sse/connection",
          params: { message: "SSE Connection established" },
        });
      } catch (error) {
        if (!closed) {
          console.error("Error connecting to server:", error);
          res.writeHead(500).end("Error connecting to server");
        }
      }

      return;
    }

    // Handle POST requests to the messages endpoint
    if (req.method === "POST" && reqUrl.pathname === messagesEndpoint) {
      const sessionId = reqUrl.searchParams.get("sessionId");

      if (!sessionId) {
        res.writeHead(400).end("No sessionId");
        return;
      }

      const activeSession = activeSessions[sessionId];
      if (!activeSession) {
        res.writeHead(404).end("No active transport");
        return;
      }

      await activeSession.transport.handlePostMessage(req, res);
      return;
    }

    // If we reach here, no handler matched
    res.writeHead(404).end("Not found");
  };

  const cleanup = () => {
    for (const [sessionId, session] of Object.entries(activeSessions)) {
      closeSession(session);
      delete activeSessions[sessionId];
    }
  };

  // 建立连接
  return createBaseHttpServer(
    port,
    endpoint,
    {
      handleRequest,
      cleanup,
      serverType: "SSE Server",
      security: {
        enableDnsRebindingProtection: options.enableDnsRebindingProtection,
        allowedHosts: options.allowedHosts,
        allowedOrigins: options.allowedOrigins,
      },
    },
    options.host
  );
}
