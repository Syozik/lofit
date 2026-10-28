import { Hono } from "hono";
import { z } from "zod";
import { invalidBody, needsAccount } from "../http";

const scopeQuery = z.object({ group: z.uuid().optional() });

export const holdingsRoute = new Hono()
    .get("/", (c) => c.json([]))
    .all("*", needsAccount("Investments need an account"));

export const portfolioRoute = new Hono()
    .get("/history", (c) => {
        const parsed = scopeQuery.safeParse(c.req.query());
        if (!parsed.success) return invalidBody(c, parsed.error.issues);
        return c.json([]);
    })
    .get("/intraday", (c) => {
        const parsed = scopeQuery.safeParse(c.req.query());
        if (!parsed.success) return invalidBody(c, parsed.error.issues);
        return c.json([]);
    });

export const pricesRoute = new Hono().post("/refresh", (c) =>
    c.json({ changed: 0, confirmed: 0, missing: 0 }),
);

export const importsRoute = new Hono().all("*", needsAccount("Importing needs an account"));
