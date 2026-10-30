import { zValidator } from "@hono/zod-validator";
import { toBase } from "@lofit/domain";
import { settingsSchema } from "@lofit/domain/schemas";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { AuthEnv } from "../auth/session";
import { db } from "../db/client";
import { holdings, users } from "../db/schema";
import { invalidBody } from "../http";
import { perBase } from "../prices/rates";

function quotedIn(previous: string) {
    return (row: typeof holdings.$inferSelect) => (row.nativePrice === null ? previous : (row.currency ?? previous));
}

export const settingsRoute = new Hono<AuthEnv>()
    .get("/", (c) => c.json({ currency: c.var.currency }))
    .patch(
        "/",
        zValidator("json", settingsSchema, (result, c) => {
            if (!result.success) return invalidBody(c, result.error.issues);
        }),
        async (c) => {
            const { currency } = c.req.valid("json");
            const userId = c.var.userId;
            const previous = c.var.currency;

            const held = await db.select().from(holdings).where(eq(holdings.userId, userId));
            const rates = new Map<string, number>();
            for (const native of new Set([previous, ...held.map(quotedIn(previous))])) {
                const rate = await perBase(native, currency);
                if (!rate && held.length > 0) {
                    throw new HTTPException(422, { message: `No ${currency} rate for ${native}` });
                }
                if (rate) rates.set(native, rate);
            }

            await db.transaction(async (tx) => {
                await tx.update(users).set({ currency, updatedAt: new Date() }).where(eq(users.id, userId));
                if (currency === previous) return;

                for (const row of held) {
                    await tx
                        .update(holdings)
                        .set({
                            price: toBase(row.nativePrice ?? row.price, rates.get(quotedIn(previous)(row)) ?? 1),
                            cost: toBase(row.cost, rates.get(previous) ?? 1),
                        })
                        .where(eq(holdings.id, row.id));
                }
            });

            return c.json({ currency });
        },
    );
