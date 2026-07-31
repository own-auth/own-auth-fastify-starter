import type { FastifyInstance, FastifyRequest } from "fastify";
import { readSessionToken } from "own-auth/http";

import { auth } from "./auth.js";
import { getServerEnv } from "./env.js";
import { toWebRequest } from "./web-request.js";

export async function registerAccountRoutes(
  app: FastifyInstance
): Promise<void> {
  app.get("/api/config", async () => ({
    emailDeliveryConfigured:
      Boolean(getServerEnv().emailDeliveryKey) || getServerEnv().testMode
  }));

  app.get("/api/account", async (request, reply) => {
    const current = await currentSession(request);
    if (!current) return reply.code(401).send({ error: "unauthorized" });

    const now = new Date();
    const sessions = (await auth.listSessions({
      actorUserId: current.user.id
    }))
      .filter(
        (session) =>
          !session.revokedAt &&
          session.expiresAt > now &&
          session.idleExpiresAt > now
      )
      .map((session) => ({
        id: session.id,
        isCurrent: session.id === current.session.id,
        lastActiveAt: session.lastActiveAt.toISOString(),
        userAgent: session.userAgent
      }))
      .sort((left, right) => Number(right.isCurrent) - Number(left.isCurrent));

    return {
      session: {
        expiresAt: current.session.expiresAt.toISOString(),
        id: current.session.id
      },
      sessions,
      user: {
        email: current.user.email,
        emailVerifiedAt: current.user.emailVerifiedAt?.toISOString() ?? null,
        id: current.user.id,
        name: current.user.name
      }
    };
  });

  app.post<{ Params: { sessionId: string } }>(
    "/api/account/sessions/:sessionId/revoke",
    async (request, reply) => {
      if (!hasTrustedOrigin(request)) {
        return reply.code(403).send({ error: "csrf_failed" });
      }
      const webRequest = toWebRequest(request as FastifyRequest);
      const { token } = readSessionToken(webRequest);
      if (!token) return reply.code(401).send({ error: "unauthorized" });

      await auth.revokeSession({
        sessionId: request.params.sessionId,
        sessionToken: token
      });
      return { success: true };
    }
  );
}

async function currentSession(request: FastifyRequest) {
  const { token } = readSessionToken(toWebRequest(request));
  return token ? auth.getCurrentSession(token) : null;
}

function hasTrustedOrigin(request: FastifyRequest): boolean {
  const origin = request.headers.origin;
  if (!origin) return false;
  try {
    return new URL(origin).origin === getServerEnv().appUrl;
  } catch {
    return false;
  }
}
