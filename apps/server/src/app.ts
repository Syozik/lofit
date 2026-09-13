import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { auth } from "./auth/auth";
import { requireSession } from "./auth/session";
import type { AuthEnv } from "./auth/session";
import { connection } from "./db/client";
import { accountsRoute } from "./routes/accounts";
import { budgetsRoute } from "./routes/budgets";
import { groupsRoute } from "./routes/groups";
import { holdingsRoute } from "./routes/holdings";
import { pricesRoute } from "./routes/prices";
import { snapshotsRoute } from "./routes/snapshots";
import { tagsRoute } from "./routes/tags";
import { transactionsRoute } from "./routes/transactions";

const resources = new Hono<AuthEnv>()
    .use(requireSession)
    .route("/accounts", accountsRoute)
    .route("/holdings", holdingsRoute)
    .route("/transactions", transactionsRoute)
    .route("/tags", tagsRoute)
    .route("/groups", groupsRoute)
    .route("/budgets", budgetsRoute)
    .route("/snapshots", snapshotsRoute)
    .route("/prices", pricesRoute);

export const app = new Hono()
    .basePath("/api")
    .on(["GET", "POST"], "/auth/*", (c) => auth.handler(c.req.raw))
    .get("/health", async (c) => {
        await connection`select 1`;
        return c.json({ ok: true });
    })
    .route("/", resources);

app.onError((error, c) => {
    if (error instanceof HTTPException) {
        return c.json({ error: error.message }, error.status);
    }
    console.error(error);
    return c.json({ error: "Internal server error" }, 500);
});

export type AppType = typeof app;
