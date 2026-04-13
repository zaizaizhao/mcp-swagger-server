const path = require("node:path");

async function main() {
  const entry = path.resolve(__dirname, "../dist/index.js");
  const {
    createMcpServer,
    transformOpenApiToMcpTools,
  } = require(entry);

  const openApiData = {
    openapi: "3.0.4",
    info: {
      title: "Smoke API",
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

  const tools = await transformOpenApiToMcpTools(
    undefined,
    "https://api.example.com",
    openApiData
  );

  if (!Array.isArray(tools) || tools.length !== 1) {
    throw new Error(`Expected exactly 1 MCP tool, received ${tools?.length ?? "unknown"}`);
  }

  if (tools[0].name !== "listPets") {
    throw new Error(`Expected tool name "listPets", received "${tools[0].name}"`);
  }

  const server = await createMcpServer({
    openApiData,
    baseUrl: "https://api.example.com",
  });

  await server.close();

  console.log("server smoke passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
