import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import type { AuthEnv } from "../auth/session";
import { invalidBody } from "../http";
import { portfolioHistory, portfolioIntraday } from "../prices/portfolio";

const scopeQuery = zValidator("query", z.object({ group: z.uuid().optional() }), (result, c) => {
    if (!result.success) return invalidBody(c, result.error.issues);
});

export const portfolioRoute = new Hono<AuthEnv>()
    .get("/history", scopeQuery, async (c) =>
        c.json(await portfolioHistory(c.var.userId, c.req.valid("query").group)),
    )
    .get("/intraday", scopeQuery, async (c) =>
        c.json(await portfolioIntraday(c.var.userId, c.req.valid("query").group)),
    );
