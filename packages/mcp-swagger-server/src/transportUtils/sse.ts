import { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { type RequestHandlers, createBaseHttpServer } from "../tools/httpServer";
import { IncomingMessage, ServerResponse } from "http";


export async function startSseMcpServer(server: McpServer, endpoint: string, port: number): Promise<void> {
    const activeTransports: Record<string, SSEServerTransport> = {};
    const handleRequest: RequestHandlers["handleRequest"] = async (
        req: IncomingMessage,
        res: ServerResponse,
    ) => {
        if (!req.url) {
            res.writeHead(400).end("No URL");
            return;
        }
        //* 创建一个URL对象，用于解析请求的URL 接收两个参数：new URL(url, base)
        const reqUrl = new URL(req.url, "http://localhost");

        // Handle GET requests to the SSE endpoint
        if (req.method === "GET" && reqUrl.pathname === endpoint) {
            const transport = new SSEServerTransport("/messages", res);

            activeTransports[transport.sessionId] = transport;

            let closed = false;

            res.on("close", async () => {
                closed = true;

                try {
                    await server.close();
                } catch (error) {
                    console.error("Error closing server:", error);
                }

                delete activeTransports[transport.sessionId];
            });

            try {
                await server.connect(transport);

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

        // Handle POST requests to the messages endpoint //* establish sse connection
        if (req.method === "POST" && req.url?.startsWith("/messages")) {
            const sessionId = new URL(
                req.url,
                "https://example.com",
            ).searchParams.get("sessionId");

            if (!sessionId) {
                res.writeHead(400).end("No sessionId");
                return;
            }

            const activeTransport: SSEServerTransport | undefined =
                activeTransports[sessionId];

            if (!activeTransport) {
                res.writeHead(400).end("No active transport");
                return;
            }

            await activeTransport.handlePostMessage(req, res);
            return;
        }

        // If we reach here, no handler matched
        res.writeHead(404).end("Not found");
    };

    const cleanup = () => {
        // Close all active transports
        for (const transport of Object.values(activeTransports)) {
            transport.close();
        }
        server.close();
    };

    // 建立连接
    createBaseHttpServer(port, endpoint, {
        handleRequest,
        cleanup,
        serverType: "SSE Server",
    });
}
