import type { FastifyInstance } from "fastify";

import { getServerEnv } from "./env.js";
import { listTestEmails } from "./test-email-provider.js";

export async function registerTestRoutes(app: FastifyInstance): Promise<void> {
  if (!getServerEnv().testMode) return;

  app.get<{ Querystring: { to?: string; type?: string } }>(
    "/api/test/emails",
    async (request) => {
      const recipient = request.query.to?.toLowerCase();
      const matching = listTestEmails().filter(
        (message) =>
          (!recipient || message.to.toLowerCase() === recipient) &&
          (!request.query.type || message.type === request.query.type)
      );
      const latest = matching.at(-1);
      return {
        count: matching.length,
        latest: latest
          ? {
              expiresAt: latest.expiresAt.toISOString(),
              to: latest.to,
              token: latest.token,
              type: latest.type,
              url: latest.url
            }
          : null
      };
    }
  );
}
