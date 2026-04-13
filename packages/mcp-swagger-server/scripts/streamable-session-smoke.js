const { once } = require("node:events");
const path = require("node:path");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function readJsonRpcPayload(response) {
  const contentType = response.headers.get("content-type") || "";
  const rawText = await response.text();

  if (contentType.includes("application/json")) {
    return rawText ? JSON.parse(rawText) : null;
  }

  if (contentType.includes("text/event-stream")) {
    const jsonCandidates = rawText
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .filter(Boolean);

    for (const candidate of jsonCandidates) {
      try {
        return JSON.parse(candidate);
      } catch {}
    }
  }

  throw new Error(
    `Unsupported response payload (${contentType || "unknown"}): ${rawText.slice(0, 500)}`
  );
}

async function initializeSession(baseUrl, id, protocolVersion) {
  const response = await fetch(`${baseUrl}/mcp`, {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id,
      method: "initialize",
      params: {
        protocolVersion,
        capabilities: {},
        clientInfo: {
          name: "streamable-session-smoke",
          version: "1.0.0",
        },
      },
    }),
  });

  const payload = await readJsonRpcPayload(response);
  const sessionId = response.headers.get("mcp-session-id");

  assert(response.ok, `initialize #${id} failed with ${response.status}: ${JSON.stringify(payload)}`);
  assert(sessionId, `initialize #${id} did not return mcp-session-id`);
  assert(payload.result, `initialize #${id} did not return a JSON-RPC result`);

  return { payload, sessionId };
}

async function notifyInitialized(baseUrl, sessionId, protocolVersion) {
  const response = await fetch(`${baseUrl}/mcp`, {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
      "mcp-session-id": sessionId,
      "mcp-protocol-version": protocolVersion,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "notifications/initialized",
    }),
  });

  assert(
    response.status === 202,
    `initialized notification for session ${sessionId} failed with ${response.status}`
  );
}

async function listTools(baseUrl, sessionId, protocolVersion, id) {
  const response = await fetch(`${baseUrl}/mcp`, {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
      "mcp-session-id": sessionId,
      "mcp-protocol-version": protocolVersion,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id,
      method: "tools/list",
    }),
  });

  const payload = await readJsonRpcPayload(response);

  assert(response.ok, `tools/list for session ${sessionId} failed with ${response.status}: ${JSON.stringify(payload)}`);
  assert(Array.isArray(payload?.result?.tools), `tools/list for session ${sessionId} returned invalid payload`);

  return payload.result.tools;
}

async function closeSession(baseUrl, sessionId, protocolVersion) {
  const response = await fetch(`${baseUrl}/mcp`, {
    method: "DELETE",
    headers: {
      accept: "application/json, text/event-stream",
      "mcp-session-id": sessionId,
      "mcp-protocol-version": protocolVersion,
    },
  });

  assert(response.ok, `delete session ${sessionId} failed with ${response.status}`);
}

async function main() {
  const entry = path.resolve(__dirname, "../dist/index.js");
  const {
    createMcpServer,
    startStreamableMcpServer,
  } = require(entry);
  const {
    DEFAULT_NEGOTIATED_PROTOCOL_VERSION,
  } = require("@modelcontextprotocol/sdk/types.js");

  const openApiData = {
    openapi: "3.0.4",
    info: {
      title: "Concurrent Session Smoke API",
      version: "1.0.0",
    },
    paths: {
      "/pets": {
        get: {
          operationId: "listPets",
          summary: "List pets",
          responses: {
            "200": {
              description: "Successful response",
            },
          },
        },
      },
    },
  };

  let factoryCalls = 0;
  const httpServer = await startStreamableMcpServer(
    async () => {
      factoryCalls += 1;
      return createMcpServer(
        {
          openApiData,
          baseUrl: "https://api.example.com",
        },
        { registerSignalHandlers: false }
      );
    },
    "/mcp",
    0,
    {
      host: "127.0.0.1",
    }
  );

  if (!httpServer.listening) {
    await once(httpServer, "listening");
  }

  const address = httpServer.address();
  assert(address && typeof address === "object", "Failed to resolve HTTP server address");

  const baseUrl = `http://127.0.0.1:${address.port}`;
  const protocolVersion = DEFAULT_NEGOTIATED_PROTOCOL_VERSION;
  let sessionA;
  let sessionB;

  try {
    sessionA = await initializeSession(baseUrl, 1, protocolVersion);
    sessionB = await initializeSession(baseUrl, 2, protocolVersion);

    assert(sessionA.sessionId !== sessionB.sessionId, "Expected unique session ids for concurrent sessions");
    assert(factoryCalls === 2, `Expected session server factory to be called twice, received ${factoryCalls}`);

    await notifyInitialized(baseUrl, sessionA.sessionId, protocolVersion);
    await notifyInitialized(baseUrl, sessionB.sessionId, protocolVersion);

    const [toolsA, toolsB] = await Promise.all([
      listTools(baseUrl, sessionA.sessionId, protocolVersion, 11),
      listTools(baseUrl, sessionB.sessionId, protocolVersion, 12),
    ]);

    assert(toolsA.length === 1, `Expected 1 tool in session A, received ${toolsA.length}`);
    assert(toolsB.length === 1, `Expected 1 tool in session B, received ${toolsB.length}`);
    assert(toolsA[0].name === "listPets", `Unexpected tool name in session A: ${toolsA[0]?.name}`);
    assert(toolsB[0].name === "listPets", `Unexpected tool name in session B: ${toolsB[0]?.name}`);
  } finally {
    try {
      if (sessionA?.sessionId) {
        await closeSession(baseUrl, sessionA.sessionId, protocolVersion);
      }
    } catch {}

    try {
      if (sessionB?.sessionId) {
        await closeSession(baseUrl, sessionB.sessionId, protocolVersion);
      }
    } catch {}

    await new Promise((resolve, reject) => {
      httpServer.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }

  console.log("streamable multi-session smoke passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
