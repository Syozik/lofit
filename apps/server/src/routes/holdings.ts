import { zValidator } from "@hono/zod-validator";
import { cents, following, paidFor, sellUnits, toBase } from "@lofit/domain";
import type { Cents } from "@lofit/domain";
import {
    holdingPatchSchema,
    newHoldingSchema,
    sellHoldingSchema,
    tradePatchSchema,
} from "@lofit/domain/schemas";
import { z } from "zod";
import { and, desc, eq, ne, sql } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { AuthEnv } from "../auth/session";
import { db } from "../db/client";
import { toHolding, toTrade } from "../db/mappers";
import { viewFor } from "../db/view";
import { accounts, holdingTrades, holdings, recurringBuys } from "../db/schema";
import { priced, rate, settle } from "../holdings";
import { currenciesOf } from "../ledger";
import { logDue } from "../recurring";
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

            const fromAccountId = entry.fromAccountId === undefined ? entry.accountId : entry.fromAccountId;
            const owned = await currenciesOf(userId);
            const buy = await priced({ ...entry, fromAccountId }, owned);

            const row = await db.transaction(async (tx) => {
                const settled = await settle(tx, userId, buy);
                if (entry.repeats) {
                    const anchor = entry.heldSince ?? new Date().toISOString().slice(0, 10);
                    const units = entry.repeats.basis === "units";
                    await tx.insert(recurringBuys).values({
                        userId,
                        symbol: entry.symbol,
                        name: entry.name,
                        type: entry.type,
                        quote: entry.quote ?? null,
                        accountId: entry.accountId,
                        fromAccountId,
                        amount: units ? null : buy.paid,
                        quantity: units ? entry.quantity : null,
                        currency: owned.get(fromAccountId ?? entry.accountId)!,
                        price: entry.price,
                        priceCurrency: entry.currency,
                        cadence: entry.repeats.cadence,
                        anchor,
                        nextDue: following(anchor, entry.repeats.cadence),
                    });
                }
                return settled;
            });

            if (entry.repeats) await logDue(userId);

            const { created, ...holding } = row;
            return c.json(toHolding(holding, await viewFor(userId, c.var.currency)), created ? 201 : 200);
        },
    )
    .get("/trades", async (c) => {
        const rows = await db
            .select()
            .from(holdingTrades)
            .where(eq(holdingTrades.userId, c.var.userId))
            .orderBy(desc(holdingTrades.day), desc(holdingTrades.createdAt));

        const view = await viewFor(c.var.userId, c.var.currency);
        return c.json(rows.map((row) => toTrade(row, view)));
    })
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
    .get(
        "/:id/trades",
        zValidator("param", z.object({ id: z.uuid() }), (result) => {
            if (!result.success) throw new HTTPException(404, { message: "No such holding" });
        }),
        async (c) => {
            const rows = await db
                .select()
                .from(holdingTrades)
                .where(and(eq(holdingTrades.holdingId, c.req.param("id")), eq(holdingTrades.userId, c.var.userId)))
                .orderBy(desc(holdingTrades.day), desc(holdingTrades.createdAt));

            const view = await viewFor(c.var.userId, c.var.currency);
            return c.json(rows.map((row) => toTrade(row, view)));
        },
    )
    .patch(
        "/:id/trades/:tradeId",
        zValidator("param", z.object({ id: z.uuid(), tradeId: z.uuid() }), (result) => {
            if (!result.success) throw new HTTPException(404, { message: "No such buy" });
        }),
        zValidator("json", tradePatchSchema, (result, c) => {
            if (!result.success) return invalidBody(c, result.error.issues);
        }),
        async (c) => {
            const { id, tradeId } = c.req.valid("param");
            const patch = c.req.valid("json");
            const userId = c.var.userId;

            const bought = and(
                eq(holdingTrades.id, tradeId),
                eq(holdingTrades.holdingId, id),
                eq(holdingTrades.userId, userId),
                eq(holdingTrades.side, "buy"),
            );

            const [found] = await db.select().from(holdingTrades).where(bought).limit(1);
            if (!found) throw new HTTPException(404, { message: "No such buy" });

            const perUnit =
                patch.price === found.price && patch.day === found.day
                    ? undefined
                    : toBase(patch.price, await rate(found.currency, found.costCurrency, patch.day));

            const row = await db.transaction(async (tx) => {
                const [held] = await tx
                    .select()
                    .from(holdings)
                    .where(and(eq(holdings.id, id), eq(holdings.userId, userId)))
                    .limit(1)
                    .for("update");
                const [trade] = await tx.select().from(holdingTrades).where(bought).limit(1);

                if (!held || !trade) throw new HTTPException(404, { message: "No such buy" });

                const more = patch.quantity - trade.quantity;
                if (held.quantity + more <= 0) {
                    throw new HTTPException(409, { message: "You have already sold more than that would leave" });
                }

                const cost =
                    perUnit === undefined
                        ? cents(Math.round((trade.cost * patch.quantity) / trade.quantity))
                        : paidFor(patch.quantity, perUnit);

                await tx
                    .update(holdingTrades)
                    .set({ quantity: patch.quantity, price: patch.price, day: patch.day, cost })
                    .where(eq(holdingTrades.id, tradeId));

                const [updated] = await tx
                    .update(holdings)
                    .set({
                        quantity: sql`${holdings.quantity} + ${more}`,
                        cost: sql`greatest(${holdings.cost} + ${cost - trade.cost}, 0)`,
                        heldSince: sql`least(${holdings.heldSince}, ${patch.day}::date)`,
                    })
                    .where(eq(holdings.id, id))
                    .returning();
                if (!updated) throw new Error("Updating a holding returned no row.");

                return updated;
            });

            return c.json(toHolding(row, await viewFor(userId, c.var.currency)));
        },
    )
    .delete(
        "/:id/trades/:tradeId",
        zValidator("param", z.object({ id: z.uuid(), tradeId: z.uuid() }), (result) => {
            if (!result.success) throw new HTTPException(404, { message: "No such buy" });
        }),
        async (c) => {
            const { id, tradeId } = c.req.valid("param");
            const userId = c.var.userId;

            const row = await db.transaction(async (tx) => {
                const [held] = await tx
                    .select()
                    .from(holdings)
                    .where(and(eq(holdings.id, id), eq(holdings.userId, userId)))
                    .limit(1)
                    .for("update");

                const [gone] = await tx
                    .delete(holdingTrades)
                    .where(
                        and(
                            eq(holdingTrades.id, tradeId),
                            eq(holdingTrades.holdingId, id),
                            eq(holdingTrades.userId, userId),
                            eq(holdingTrades.side, "buy"),
                            ne(holdingTrades.source, "opening"),
                        ),
                    )
                    .returning();

                if (!held || !gone) throw new HTTPException(404, { message: "No such buy" });
                if (gone.quantity >= held.quantity) {
                    throw new HTTPException(409, { message: "That is all you hold, remove the holding instead" });
                }

                const [updated] = await tx
                    .update(holdings)
                    .set({
                        quantity: sql`${holdings.quantity} - ${gone.quantity}`,
                        cost: sql`greatest(${holdings.cost} - ${gone.cost}, 0)`,
                    })
                    .where(eq(holdings.id, id))
                    .returning();
                if (!updated) throw new Error("Updating a holding returned no row.");

                return updated;
            });

            return c.json(toHolding(row, await viewFor(userId, c.var.currency)));
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

            const view = await viewFor(userId, c.var.currency);

            const row = await db.transaction(async (tx) => {
                const [current] = await tx
                    .select()
                    .from(holdings)
                    .where(and(eq(holdings.id, id), eq(holdings.userId, userId)))
                    .limit(1)
                    .for("update");

                if (!current) throw new HTTPException(404, { message: "No such holding" });

                const symbol = patch.symbol ?? current.symbol;
                if (symbol !== current.symbol) {
                    const [taken] = await tx
                        .select({ id: holdings.id })
                        .from(holdings)
                        .where(and(eq(holdings.userId, userId), eq(holdings.accountId, current.accountId), eq(holdings.symbol, symbol)))
                        .limit(1);
                    if (taken) throw new HTTPException(409, { message: `You already hold ${symbol} in this account` });
                }

                const renamed = {
                    symbol,
                    name: patch.name ?? current.name,
                    quote: patch.quote === undefined ? current.quote : patch.quote,
                };

                const [updated] = await tx
                    .update(holdings)
                    .set({
                        ...renamed,
                        quantity: patch.quantity,
                        cost: view.fx.convert(patch.cost, c.var.currency, current.costCurrency),
                        heldSince: patch.heldSince,
                    })
                    .where(and(eq(holdings.id, id), eq(holdings.userId, userId)))
                    .returning();
                if (!updated) throw new Error("Updating a holding returned no row.");

                await tx
                    .update(recurringBuys)
                    .set(renamed)
                    .where(
                        and(
                            eq(recurringBuys.userId, userId),
                            eq(recurringBuys.accountId, current.accountId),
                            eq(recurringBuys.symbol, current.symbol),
                        ),
                    );

                return updated;
            });

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
                    .limit(1)
                    .for("update");

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
                    await tx.insert(holdingTrades).values({
                        userId,
                        holdingId: id,
                        side: "sell",
                        quantity: result.sold,
                        price: order.price,
                        currency: sold.currency,
                        cost: result.proceeds,
                        costCurrency: held.costCurrency,
                    });
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
