"use strict";

const { initToolsFromSpec } = require("../dist/lib/initTools.js");

async function main() {
  const registeredTools = [];
  const fakeServer = {
    registerTool(name, registration, handler) {
      registeredTools.push({ name, registration, handler });
    },
  };

  const spec = {
    openapi: "3.0.0",
    info: {
      title: "Spec Smoke",
      version: "1.0.0",
    },
    servers: [
      {
        url: "https://example.com/api",
      },
    ],
    paths: {
      "/ping": {
        get: {
          operationId: "ping",
          summary: "Ping endpoint",
          responses: {
            "200": {
              description: "ok",
            },
          },
        },
      },
    },
  };

  await initToolsFromSpec(fakeServer, spec, {});

  if (registeredTools.length === 0) {
    throw new Error("Expected tools to be registered from spec input");
  }

  const pingTool = registeredTools.find((tool) => tool.name.includes("ping"));
  if (!pingTool) {
    throw new Error("Expected ping tool to be generated from spec input");
  }

  console.log(
    `[transform-from-spec-smoke] ok: registered ${registeredTools.length} tools from direct spec input`,
  );
}

main().catch((error) => {
  console.error("[transform-from-spec-smoke] failed", error);
  process.exit(1);
});
