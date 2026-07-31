import type { FastifyInstance, FastifyRequest } from "fastify";
import { createOwnAuthHandler } from "own-auth/http";

import { auth } from "./auth.js";
import { getServerEnv } from "./env.js";
import { toWebRequest } from "./web-request.js";

const maxAuthBodyBytes = 64 * 1024;
const requestContexts = new WeakMap<
  Request,
  { ipAddress?: string; userAgent?: string }
>();
const authHandler = createOwnAuthHandler(auth, {
  getRequestContext: (request) => requestContexts.get(request) ?? {},
  maxRequestBodyBytes: maxAuthBodyBytes,
  trustedOrigins: [getServerEnv().appUrl]
});

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  await app.register(
    (routes, _options, done) => {
      routes.removeAllContentTypeParsers();
      routes.addContentTypeParser(
        "*",
        { bodyLimit: maxAuthBodyBytes, parseAs: "buffer" },
        (_request, body, parseDone) => parseDone(null, body)
      );
      routes.setErrorHandler((error, _request, reply) => {
        const code =
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          typeof error.code === "string"
            ? error.code
            : null;
        if (code === "FST_ERR_CTP_BODY_TOO_LARGE") {
          return reply.code(413).send({
            error: {
              code: "invalid_request",
              message: "Request body is too large"
            }
          });
        }
        if (code === "FST_ERR_CTP_INVALID_CONTENT_LENGTH") {
          return reply.code(400).send({
            error: {
              code: "invalid_request",
              message: "Invalid Content-Length"
            }
          });
        }
        throw error;
      });
      routes.all(
        "/*",
        { bodyLimit: maxAuthBodyBytes },
        async (request, reply) => {
          const webRequest = toWebRequest(request as FastifyRequest);
          requestContexts.set(webRequest, {
            ipAddress: request.ip,
            userAgent: request.headers["user-agent"]
          });
          return reply.send(await authHandler(webRequest));
        }
      );
      done();
    },
    { prefix: "/api/auth" }
  );
}
