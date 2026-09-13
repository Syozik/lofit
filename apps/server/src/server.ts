import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import { app } from "./app";
import { env } from "./env";
import { rateLimit } from "./rateLimit";

export const server = new Hono().use(logger()).use(secureHeaders()).use(rateLimit).route("/", app);

if (env.webRoot) {
    const root = env.webRoot;
    server.use("*", serveStatic({ root }));
    server.get("*", serveStatic({ path: `${root}/index.html` }));
}
