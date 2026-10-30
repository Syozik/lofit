import { zValidator } from "@hono/zod-validator";
import { budgetLimitSchema } from "@lofit/domain/schemas";
import { and, asc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import type { AuthEnv } from "../auth/session";
import { db } from "../db/client";
import { toBudget } from "../db/mappers";
import { budgets, tags } from "../db/schema";
import { viewFor } from "../db/view";
import { invalidBody } from "../http";

const tagParam = zValidator("param", z.object({ tagId: z.uuid() }), (result) => {
    if (!result.success) throw new HTTPException(404, { message: "No such tag" });
});

export const budgetsRoute = new Hono<AuthEnv>()
    .get("/", async (c) => {
        const rows = await db
            .select({ tagId: budgets.tagId, limit: budgets.limit, currency: budgets.currency })
            .from(budgets)
            .innerJoin(tags, and(eq(tags.id, budgets.tagId), eq(tags.userId, budgets.userId)))
            .where(eq(budgets.userId, c.var.userId))
            .orderBy(asc(tags.position));

        const view = await viewFor(c.var.userId, c.var.currency);
        return c.json(rows.map((row) => toBudget(row, view)));
    })
    .put(
        "/:tagId",
        tagParam,
        zValidator("json", budgetLimitSchema, (result, c) => {
            if (!result.success) return invalidBody(c, result.error.issues);
        }),
        async (c) => {
            const { tagId } = c.req.valid("param");
            const { limit } = c.req.valid("json");
            const userId = c.var.userId;

            const [tag] = await db
                .select({ id: tags.id })
                .from(tags)
                .where(and(eq(tags.id, tagId), eq(tags.userId, userId)))
                .limit(1);
            if (!tag) throw new HTTPException(404, { message: "No such tag" });

            const [row] = await db
                .insert(budgets)
                .values({ userId, tagId, limit, currency: c.var.currency })
                .onConflictDoUpdate({
                    target: [budgets.userId, budgets.tagId],
                    set: { limit, currency: c.var.currency },
                })
                .returning({ tagId: budgets.tagId, limit: budgets.limit, currency: budgets.currency });
            if (!row) throw new Error("Saving a budget returned no row.");

            return c.json(toBudget(row));
        },
    )
    .delete("/:tagId", tagParam, async (c) => {
        const { tagId } = c.req.valid("param");

        await db
            .delete(budgets)
            .where(and(eq(budgets.tagId, tagId), eq(budgets.userId, c.var.userId)));

        return c.body(null, 204);
    });
