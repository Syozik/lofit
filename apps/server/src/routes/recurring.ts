import { zValidator } from "@hono/zod-validator";
import { following } from "@lofit/domain";
import { newRecurringSchema, recurringPatchSchema } from "@lofit/domain/schemas";
import { and, asc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import type { AuthEnv } from "../auth/session";
import { db } from "../db/client";
import { toRecurring } from "../db/mappers";
import { recurring } from "../db/schema";
import { viewFor } from "../db/view";
import { invalidBody } from "../http";
import { checkTags, currenciesOf } from "../ledger";
import { logDue } from "../recurring";

const idParam = zValidator("param", z.object({ id: z.uuid() }), (result) => {
    if (!result.success) throw new HTTPException(404, { message: "No such recurring entry" });
});

export const recurringRoute = new Hono<AuthEnv>()
    .get("/", async (c) => {
        const rows = await db
            .select()
            .from(recurring)
            .where(eq(recurring.userId, c.var.userId))
            .orderBy(asc(recurring.nextDue), asc(recurring.name));

        const view = await viewFor(c.var.userId, c.var.currency);
        return c.json(rows.map((row) => toRecurring(row, view)));
    })
    .post(
        "/",
        zValidator("json", newRecurringSchema, (result, c) => {
            if (!result.success) return invalidBody(c, result.error.issues);
        }),
        async (c) => {
            const draft = c.req.valid("json");
            const userId = c.var.userId;

            const owned = await currenciesOf(userId);
            if (!owned.has(draft.accountId) || (draft.toAccountId && !owned.has(draft.toAccountId))) {
                throw new HTTPException(422, { message: "Unknown account" });
            }

            const row = await db.transaction(async (tx) => {
                await checkTags(tx, userId, draft);
                const [created] = await tx
                    .insert(recurring)
                    .values({
                        ...(draft.id ? { id: draft.id } : {}),
                        userId,
                        name: draft.name,
                        kind: draft.kind,
                        tagIds: [...draft.tagIds],
                        accountId: draft.accountId,
                        toAccountId: draft.toAccountId ?? null,
                        amount: draft.amount,
                        toAmount: draft.toAmount ?? null,
                        currency: draft.currency,
                        cadence: draft.cadence,
                        anchor: draft.anchor,
                        nextDue: following(draft.anchor, draft.cadence),
                    })
                    .onConflictDoNothing()
                    .returning();
                return created;
            });

            await logDue(userId);

            const [current] = await db
                .select()
                .from(recurring)
                .where(and(eq(recurring.id, row?.id ?? draft.id ?? ""), eq(recurring.userId, userId)))
                .limit(1);
            if (!current) throw new HTTPException(409, { message: "That id is taken" });

            return c.json(toRecurring(current, await viewFor(userId, c.var.currency)), row ? 201 : 200);
        },
    )
    .patch(
        "/:id",
        idParam,
        zValidator("json", recurringPatchSchema, (result, c) => {
            if (!result.success) return invalidBody(c, result.error.issues);
        }),
        async (c) => {
            const { id } = c.req.valid("param");
            const userId = c.var.userId;
            const patch = c.req.valid("json");

            const [current] = await db
                .select()
                .from(recurring)
                .where(and(eq(recurring.id, id), eq(recurring.userId, userId)))
                .limit(1);
            if (!current) throw new HTTPException(404, { message: "No such recurring entry" });

            const amount = patch.amount ?? current.amount;
            if (current.kind === "income" ? amount <= 0 : amount >= 0) {
                throw new HTTPException(422, { message: "Income is positive; expenses and transfers are negative" });
            }

            const [updated] = await db
                .update(recurring)
                .set({
                    ...(patch.name ? { name: patch.name } : {}),
                    amount,
                    ...(patch.cadence ? { cadence: patch.cadence } : {}),
                    ...(patch.nextDue ? { nextDue: patch.nextDue, anchor: patch.nextDue } : {}),
                    ...(patch.paused !== undefined ? { paused: patch.paused } : {}),
                })
                .where(eq(recurring.id, id))
                .returning();

            await logDue(userId);
            const [fresh] = await db.select().from(recurring).where(eq(recurring.id, id)).limit(1);

            return c.json(toRecurring(fresh ?? updated!, await viewFor(userId, c.var.currency)));
        },
    )
    .delete("/:id", idParam, async (c) => {
        const { id } = c.req.valid("param");
        const [gone] = await db
            .delete(recurring)
            .where(and(eq(recurring.id, id), eq(recurring.userId, c.var.userId)))
            .returning({ id: recurring.id });
        if (!gone) throw new HTTPException(404, { message: "No such recurring entry" });
        return c.body(null, 204);
    });
