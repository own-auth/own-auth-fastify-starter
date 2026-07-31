import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import fastifyStatic from "@fastify/static";
import Fastify from "fastify";

import { registerAccountRoutes } from "./account-routes.js";
import { registerAuthRoutes } from "./auth-routes.js";
import { getServerEnv } from "./env.js";
import { registerTestRoutes } from "./test-routes.js";

const env = getServerEnv();
const app = Fastify({
  logger: true
});

await registerAuthRoutes(app);
await registerAccountRoutes(app);
await registerTestRoutes(app);

if (process.env.NODE_ENV === "production") {
  const clientRoot = fileURLToPath(new URL("../dist/client", import.meta.url));
  if (!existsSync(clientRoot)) {
    throw new Error("Client build not found. Run npm run build first.");
  }
  await app.register(fastifyStatic, {
    root: clientRoot,
    wildcard: false
  });
  app.get("/*", async (_request, reply) => reply.sendFile("index.html"));
}

await app.listen({ host: "0.0.0.0", port: env.port });
