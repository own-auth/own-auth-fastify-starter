import type { FastifyRequest } from "fastify";

export function toWebRequest(request: FastifyRequest): Request {
  if (!request.host) throw new Error("Host header is required");

  const method = request.method.toUpperCase();
  const init: RequestInit & { duplex?: "half" } = {
    method,
    headers: toWebHeaders(request)
  };

  if (method !== "GET" && method !== "HEAD" && Buffer.isBuffer(request.body)) {
    init.body = request.body as unknown as BodyInit;
    init.duplex = "half";
  }

  return new Request(
    new URL(request.raw.url ?? "/", `${request.protocol}://${request.host}`),
    init
  );
}

function toWebHeaders(request: FastifyRequest): Headers {
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) {
      for (const entry of value) headers.append(name, entry);
    } else if (value !== undefined) {
      headers.set(name, value);
    }
  }
  return headers;
}
