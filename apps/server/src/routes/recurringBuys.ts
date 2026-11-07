import { zValidator } from "@hono/zod-validator";
import { recurringBuyPatchSchema } from "@lofit/domain/schemas";
import { and, asc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import type { AuthEnv } from "../auth/session";
import { db } from "../db/client";
import { toRecurringBuy } from "../db/mappers";
import { recurringBuys } from "../db/schema";
import { invalidBody } from "../http";
import { logDue } from "../recurring";

const idParam = zValidator("param", z.object({ id: z.uuid() }), (result) => {
    if (!result.success) throw new HTTPException(404, { message: "No such recurring buy" });
});

export const recurringBuysRoute = new Hono<AuthEnv>()
    .get("/", async (c) => {
        const rows = await db
            .select()
            .from(recurringBuys)
            .where(eq(recurringBuys.userId, c.var.userId))
            .orderBy(asc(recurringBuys.nextDue), asc(recurringBuys.symbol));

        return c.json(rows.map((row) => toRecurringBuy(row)));
    })
    .patch(
        "/:id",
        idParam,
        zValidator("json", recurringBuyPatchSchema, (result, c) => {
            if (!result.success) return invalidBody(c, result.error.issues);
        }),
        async (c) => {
            const { id } = c.req.valid("param");
            const userId = c.var.userId;
            const patch = c.req.valid("json");

            const [current] = await db
                .select()
                .from(recurringBuys)
                .where(and(eq(recurringBuys.id, id), eq(recurringBuys.userId, userId)))
                .limit(1);
            if (!current) throw new HTTPException(404, { message: "No such recurring buy" });

            const changes = {
                ...(patch.amount !== undefined && current.amount !== null ? { amount: patch.amount } : {}),
                ...(patch.quantity !== undefined && current.quantity !== null ? { quantity: patch.quantity } : {}),
                ...(patch.paused !== undefined ? { paused: patch.paused } : {}),
            };
            if (Object.keys(changes).length > 0) {
                await db.update(recurringBuys).set(changes).where(eq(recurringBuys.id, id));
            }

            await logDue(userId);
            const [fresh] = await db.select().from(recurringBuys).where(eq(recurringBuys.id, id)).limit(1);
            if (!fresh) throw new HTTPException(404, { message: "No such recurring buy" });

            return c.json(toRecurringBuy(fresh));
        },
    )
    .delete("/:id", idParam, async (c) => {
        const { id } = c.req.valid("param");
        const [gone] = await db
            .delete(recurringBuys)
            .where(and(eq(recurringBuys.id, id), eq(recurringBuys.userId, c.var.userId)))
            .returning({ id: recurringBuys.id });
        if (!gone) throw new HTTPException(404, { message: "No such recurring buy" });
        return c.body(null, 204);
    });
