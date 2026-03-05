import type { IncomingMessage } from "node:http";

export function getBody<T = unknown>(request: IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    const bodyParts: Buffer[] = [];

    request
      .on("data", (chunk: Buffer | string) => {
        bodyParts.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      })
      .on("error", (error) => {
        reject(error);
      })
      .on("end", () => {
        const rawBody = Buffer.concat(bodyParts).toString().trim();

        if (!rawBody) {
          resolve({} as T);
          return;
        }

        try {
          resolve(JSON.parse(rawBody) as T);
        } catch (error) {
          reject(new Error(`Invalid JSON request body: ${(error as Error).message}`));
        }
      });
  });
}
