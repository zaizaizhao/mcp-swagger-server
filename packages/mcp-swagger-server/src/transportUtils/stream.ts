import { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import {
    type EventStore,
    StreamableHTTPServerTransport,
  } from "@modelcontextprotocol/sdk/server/streamableHttp";
import { InMemoryEventStore } from "../tools/InMemoryEventStore";
import { randomUUID } from "node:crypto";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types";
import type { IncomingMessage, ServerResponse, Server } from "node:http";
import { createBaseHttpServer, RequestHandlers } from "../tools/httpServer";
import { getBody } from "../tools/getBody";

export async function startStreamableMcpServer(server: McpServer, endpoint: string, port: number,eventStore: EventStore = new InMemoryEventStore(),): Promise<Server> {
    const activeTransports: Record<
    string,
    {
      server: McpServer;
      transport: StreamableHTTPServerTransport;
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
              };
            },
            sessionIdGenerator: randomUUID,
          });

          // Handle the server close event.
          transport.onclose = async () => {
            const sid = transport.sessionId;
            if (sid && activeTransports[sid]) {
              try {
                await server?.close();
              } catch (error) {
                console.error("Error closing server:", error);
              }

              // delete used transport and server to avoid memory leak.
              delete activeTransports[sid];
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
        console.log(`Establishing new SSE stream for session ${sessionId}`);
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

      const transport = activeTransports[sessionId]?.transport;
      if (!transport) {
        res.writeHead(400).end("No active transport");
        return;
      }

      try {
        await transport.handleRequest(req, res);
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
    for (const { server, transport } of Object.values(activeTransports)) {
      transport.close();
      server.close();
    }
  };

  // Create the HTTP server using our factory
  const httpServer = createBaseHttpServer(port, endpoint, {
    handleRequest,
    cleanup,
    serverType: "HTTP Streamable Server",
  });
    // const transport = new StreamableServerTransport();
    // await server.connect(transport);
    
    return httpServer;
}
