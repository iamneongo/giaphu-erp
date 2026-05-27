import { neon, neonConfig } from "@neondatabase/serverless";

import https from "node:https";

function configureNodeFetchForNeon() {
  if (typeof window !== "undefined" || neonConfig.fetchFunction) {
    return;
  }

  neonConfig.fetchFunction = async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    const body =
      request.method === "GET" || request.method === "HEAD" ? undefined : Buffer.from(await request.arrayBuffer());

    return await new Promise<Response>((resolve, reject) => {
      const responseHeaders = new Headers();
      const req = https.request(
        url,
        {
          method: request.method,
          headers: Object.fromEntries(request.headers.entries()),
          family: 4,
          timeout: 30_000,
        },
        (response) => {
          for (const [key, value] of Object.entries(response.headers)) {
            if (Array.isArray(value)) {
              for (const headerValue of value) {
                responseHeaders.append(key, headerValue);
              }
              continue;
            }

            if (typeof value === "string") {
              responseHeaders.set(key, value);
            }
          }

          const chunks: Buffer[] = [];
          response.on("data", (chunk) => {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          });
          response.on("end", () => {
            resolve(
              new Response(Buffer.concat(chunks), {
                headers: responseHeaders,
                status: response.statusCode ?? 500,
                statusText: response.statusMessage,
              }),
            );
          });
        },
      );

      req.on("error", reject);
      req.on("timeout", () => {
        req.destroy(new Error(`Request to ${url.host} timed out`));
      });

      if (request.signal.aborted) {
        req.destroy(new DOMException("The request was aborted.", "AbortError"));
        return;
      }

      request.signal.addEventListener(
        "abort",
        () => {
          req.destroy(new DOMException("The request was aborted.", "AbortError"));
        },
        { once: true },
      );

      if (body) {
        req.write(body);
      }

      req.end();
    });
  };
}

export function hasDatabaseUrl() {
  return Boolean(process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? process.env.NEON_DATABASE_URL);
}

export function getSql() {
  configureNodeFetchForNeon();
  const databaseUrl = process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? process.env.NEON_DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("Missing DATABASE_URL. Add your Neon connection string to .env.local.");
  }

  return neon(databaseUrl);
}
