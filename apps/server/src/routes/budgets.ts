import { and, asc, eq } from "drizzle-orm";
import { Hono } from "hono";
import type { AuthEnv } from "../auth/session";
import { db } from "../db/client";
import { toBudget } from "../db/mappers";
import { budgets, tags } from "../db/schema";

export const budgetsRoute = new Hono<AuthEnv>().get("/", async (c) => {
    const rows = await db
        .select({ tagId: budgets.tagId, limit: budgets.limit })
        .from(budgets)
        .innerJoin(tags, and(eq(tags.id, budgets.tagId), eq(tags.userId, budgets.userId)))
        .where(eq(budgets.userId, c.var.userId))
        .orderBy(asc(tags.position));

    return c.json(rows.map(toBudget));
});
