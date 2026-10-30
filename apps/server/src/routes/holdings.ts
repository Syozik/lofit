import { zValidator } from "@hono/zod-validator";
import { cents, paidFor, sellUnits, toBase } from "@lofit/domain";
import type { Cents } from "@lofit/domain";
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
import { viewFor } from "../db/view";
import { accounts, holdings } from "../db/schema";
import { priceHistory } from "../prices/history";
import { perBase } from "../prices/rates";
import { invalidBody } from "../http";

export const holdingsRoute = new Hono<AuthEnv>()
    .get("/", async (c) => {
        const rows = await db
            .select()
            .from(holdings)
            .where(eq(holdings.userId, c.var.userId))
            .orderBy(desc(sql`${holdings.quantity} * ${holdings.price}`));

        const view = await viewFor(c.var.userId, c.var.currency);
        return c.json(rows.map((row) => toHolding(row, view)));
    })
    .post(
        "/",
        zValidator("json", newHoldingSchema, (result, c) => {
            if (!result.success) return invalidBody(c, result.error.issues);
        }),
        async (c) => {
            const entry = c.req.valid("json");
            const userId = c.var.userId;

            const [account] = await db
                .select({ id: accounts.id, currency: accounts.currency })
                .from(accounts)
                .where(and(eq(accounts.id, entry.accountId), eq(accounts.userId, userId)))
                .limit(1);

            if (!account) throw new HTTPException(422, { message: "Unknown account" });

            const rate = await perBase(entry.currency, account.currency);
            if (!rate) {
                throw new HTTPException(422, {
                    message: `No ${account.currency} rate for ${entry.currency}`,
                });
            }

            const price = toBase(entry.price, rate);
            const cost = paidFor(entry.quantity, price);

            const row = await db.transaction(async (tx) => {
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
                        costCurrency: account.currency,
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
            return c.json(toHolding(holding, await viewFor(userId, c.var.currency)), created ? 201 : 200);
        },
    )
    .get(
        "/:id/history",
        zValidator("param", z.object({ id: z.uuid() }), (result) => {
            if (!result.success) throw new HTTPException(404, { message: "No such holding" });
        }),
        async (c) => {
            const [held] = await db
                .select({ quote: holdings.quote, heldSince: holdings.heldSince })
                .from(holdings)
                .where(and(eq(holdings.id, c.req.param("id")), eq(holdings.userId, c.var.userId)))
                .limit(1);

            if (!held) throw new HTTPException(404, { message: "No such holding" });

            return c.json(held.quote ? await priceHistory(held.quote, held.heldSince, c.var.currency) : null);
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
            const userId = c.var.userId;

            const [current] = await db
                .select({ costCurrency: holdings.costCurrency })
                .from(holdings)
                .where(and(eq(holdings.id, id), eq(holdings.userId, userId)))
                .limit(1);

            if (!current) throw new HTTPException(404, { message: "No such holding" });

            const view = await viewFor(userId, c.var.currency);
            const cost = view.fx.convert(patch.cost, c.var.currency, current.costCurrency);

            const [row] = await db
                .update(holdings)
                .set({ quantity: patch.quantity, cost, heldSince: patch.heldSince })
                .where(and(eq(holdings.id, id), eq(holdings.userId, userId)))
                .returning();

            if (!row) throw new HTTPException(404, { message: "No such holding" });

            return c.json(toHolding(row, view));
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
                const rate = await perBase(sold.currency, held.costCurrency);
                if (!rate) {
                    throw new HTTPException(422, {
                        message: `No ${held.costCurrency} rate for ${sold.currency}`,
                    });
                }

                const result = sellUnits(sold, order.quantity, toBase(order.price, rate));

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

                return { ...result, currency: held.costCurrency };
            });

            const view = await viewFor(userId, c.var.currency);
            const shown = (amount: Cents) => view.fx.convert(amount, sale.currency, c.var.currency);
            return c.json({
                sold: sale.sold,
                proceeds: shown(sale.proceeds),
                realised: shown(cents(sale.proceeds - sale.costSold)),
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
