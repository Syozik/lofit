import { zValidator } from "@hono/zod-validator";
import { paidFor, sellUnits, toEuros } from "@lofit/domain";
import {
    holdingPatchSchema,
    newHoldingSchema,
    sellHoldingSchema,
} from "@lofit/domain/schemas";
import { z } from "zod";
import { and, desc, eq, getTableColumns, sql } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { AuthEnv } from "../auth/session";
import { db } from "../db/client";
import { toHolding } from "../db/mappers";
import { accounts, holdings } from "../db/schema";
import { priceHistory } from "../prices/history";
import { perEuro } from "../prices/rates";
import { invalidBody } from "../http";

export const holdingsRoute = new Hono<AuthEnv>()
    .get("/", async (c) => {
        const rows = await db
            .select()
            .from(holdings)
            .where(eq(holdings.userId, c.var.userId))
            .orderBy(desc(sql`${holdings.quantity} * ${holdings.price}`));

        return c.json(rows.map(toHolding));
    })
    .post(
        "/",
        zValidator("json", newHoldingSchema, (result, c) => {
            if (!result.success) return invalidBody(c, result.error.issues);
        }),
        async (c) => {
            const entry = c.req.valid("json");
            const userId = c.var.userId;

            const rate = await perEuro(entry.currency);
            if (!rate) {
                throw new HTTPException(422, {
                    message: `No euro rate for ${entry.currency}`,
                });
            }

            const price = toEuros(entry.price, rate);
            const cost = paidFor(entry.quantity, price);

            const row = await db.transaction(async (tx) => {
                const [account] = await tx
                    .select({ id: accounts.id })
                    .from(accounts)
                    .where(and(eq(accounts.id, entry.accountId), eq(accounts.userId, userId)))
                    .limit(1);

                if (!account) throw new HTTPException(422, { message: "Unknown account" });

                const [upserted] = await tx
                    .insert(holdings)
                    .values({
                        userId,
                        symbol: entry.symbol,
                        name: entry.name,
                        type: entry.type,
                        accountId: entry.accountId,
                        quantity: entry.quantity,
                        price,
                        nativePrice: entry.price,
                        currency: entry.currency,
                        cost,
                        ...(entry.heldSince ? { heldSince: entry.heldSince } : {}),
                        pricedAt: entry.pricedAt ? new Date(entry.pricedAt) : null,
                        quote: entry.quote ?? null,
                    })
                    .onConflictDoUpdate({
                        target: [holdings.userId, holdings.symbol, holdings.accountId],
                        set: {
                            quantity: sql`${holdings.quantity} + excluded.quantity`,
                            price: sql`excluded.price`,
                            nativePrice: sql`excluded.native_price`,
                            currency: sql`excluded.currency`,
                            quote: sql`coalesce(excluded.quote, ${holdings.quote})`,
                            cost: sql`${holdings.cost} + excluded.cost`,
                            heldSince: sql`least(${holdings.heldSince}, excluded.held_since)`,
                            pricedAt: sql`excluded.priced_at`,
                        },
                    })
                    .returning({ ...getTableColumns(holdings), created: sql<boolean>`xmax = 0` });

                if (!upserted) throw new Error("Upserting a holding returned no row.");
                return upserted;
            });

            const { created, ...holding } = row;
            return c.json(toHolding(holding), created ? 201 : 200);
        },
    )
    .get(
        "/:id/history",
        zValidator("param", z.object({ id: z.uuid() }), (result) => {
            if (!result.success) throw new HTTPException(404, { message: "No such holding" });
        }),
        async (c) => {
            const [held] = await db
                .select({ quote: holdings.quote })
                .from(holdings)
                .where(and(eq(holdings.id, c.req.param("id")), eq(holdings.userId, c.var.userId)))
                .limit(1);

            if (!held) throw new HTTPException(404, { message: "No such holding" });

            return c.json(held.quote ? await priceHistory(held.quote) : []);
        },
    )
    .patch(
        "/:id",
        zValidator("param", z.object({ id: z.uuid() }), (result) => {
            if (!result.success) throw new HTTPException(404, { message: "No such holding" });
        }),
        zValidator("json", holdingPatchSchema, (result, c) => {
            if (!result.success) return invalidBody(c, result.error.issues);
        }),
        async (c) => {
            const id = c.req.param("id");
            const patch = c.req.valid("json");

            const [row] = await db
                .update(holdings)
                .set({ quantity: patch.quantity, cost: patch.cost, heldSince: patch.heldSince })
                .where(and(eq(holdings.id, id), eq(holdings.userId, c.var.userId)))
                .returning();

            if (!row) throw new HTTPException(404, { message: "No such holding" });

            return c.json(toHolding(row));
        },
    )
    .post(
        "/:id/sell",
        zValidator("param", z.object({ id: z.uuid() }), (result) => {
            if (!result.success) throw new HTTPException(404, { message: "No such holding" });
        }),
        zValidator("json", sellHoldingSchema, (result, c) => {
            if (!result.success) return invalidBody(c, result.error.issues);
        }),
        async (c) => {
            const id = c.req.param("id");
            const order = c.req.valid("json");
            const userId = c.var.userId;

            const sale = await db.transaction(async (tx) => {
                const [held] = await tx
                    .select()
                    .from(holdings)
                    .where(and(eq(holdings.id, id), eq(holdings.userId, userId)))
                    .limit(1);

                if (!held) throw new HTTPException(404, { message: "No such holding" });

                const sold = toHolding(held);
                const rate = await perEuro(sold.currency);
                if (!rate) {
                    throw new HTTPException(422, {
                        message: `No euro rate for ${sold.currency}`,
                    });
                }

                const result = sellUnits(sold, order.quantity, toEuros(order.price, rate));

                if (result.left) {
                    await tx
                        .update(holdings)
                        .set({ quantity: result.left.quantity, cost: result.left.cost })
                        .where(eq(holdings.id, id));
                } else {
                    await tx.delete(holdings).where(eq(holdings.id, id));
                }

                await tx
                    .update(accounts)
                    .set({ balance: sql`${accounts.balance} + ${result.proceeds}` })
                    .where(and(eq(accounts.id, held.accountId), eq(accounts.userId, userId)));

                return result;
            });

            return c.json({
                sold: sale.sold,
                proceeds: sale.proceeds,
                realised: sale.proceeds - sale.costSold,
            });
        },
    )
    .delete(
        "/:id",
        zValidator("param", z.object({ id: z.uuid() }), (result) => {
            if (!result.success) throw new HTTPException(404, { message: "No such holding" });
        }),
        async (c) => {
            const [gone] = await db
                .delete(holdings)
                .where(and(eq(holdings.id, c.req.param("id")), eq(holdings.userId, c.var.userId)))
                .returning({ id: holdings.id });

            if (!gone) throw new HTTPException(404, { message: "No such holding" });

            return c.body(null, 204);
        },
    );
