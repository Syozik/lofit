import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { accountsRoute } from "./routes/accounts";
import { budgetsRoute } from "./routes/budgets";
import { groupsRoute } from "./routes/groups";
import { settingsRoute } from "./routes/settings";
import { tagsRoute } from "./routes/tags";
import { transactionsRoute } from "./routes/transactions";
import { holdingsRoute, importsRoute, portfolioRoute, pricesRoute } from "./routes/unsupported";
import type { Store } from "./store";

export function localApp(store: Store) {
    const app = new Hono()
        .basePath("/api")
        .get("/health", (c) => c.json({ ok: true }))
        .route("/accounts", accountsRoute(store))
        .route("/holdings", holdingsRoute)
        .route("/portfolio", portfolioRoute)
        .route("/transactions", transactionsRoute(store))
        .route("/tags", tagsRoute(store))
        .route("/groups", groupsRoute(store))
        .route("/budgets", budgetsRoute(store))
        .route("/snapshots", new Hono().get("/", (c) => c.json(store.data.snapshots)))
        .route("/settings", settingsRoute(store))
        .route("/prices", pricesRoute)
        .route("/imports", importsRoute);

    app.onError((error, c) => {
        if (error instanceof HTTPException) {
            return c.json({ error: error.message }, error.status);
        }
        console.error(error);
        return c.json({ error: "Internal server error" }, 500);
    });

    return app;
}
