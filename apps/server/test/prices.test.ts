import { cents, euros, quoteKey } from "@lofit/domain";
import type { Cents, QuoteRef } from "@lofit/domain";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "../src/db/client";
import { holdings } from "../src/db/schema";
import { refreshPrices } from "../src/prices/refresh";
import type { Quote, QuoteFetcher } from "../src/prices/refresh";
import { signedIn } from "./client";
import { createHolding, createUser } from "./factories";

const takenAt = new Date("2026-10-04T10:00:00Z");

const fetcher = (prices: Record<string, Cents>): QuoteFetcher => {
    return async (refs: readonly QuoteRef[]) => {
        const quotes = new Map<string, Quote>();
        for (const ref of refs) {
            const price = prices[quoteKey(ref)];
            if (price !== undefined) {
                quotes.set(quoteKey(ref), {
                    price,
                    nativePrice: price,
                    currency: "EUR",
                    at: takenAt,
                });
            }
        }
        return quotes;
    };
};

const bitcoin: QuoteRef = { source: "coingecko", id: "bitcoin" };
const vwrl: QuoteRef = { source: "yahoo", symbol: "VWRL.AS" };

const priceOf = async (id: string) => {
    const [row] = await db
        .select({ price: holdings.price, pricedAt: holdings.pricedAt })
        .from(holdings)
        .where(eq(holdings.id, id));
    return row;
};

describe("refreshPrices", () => {
    it("writes the new price and stamps when it was taken", async () => {
        const me = await createUser();
        const held = await createHolding(me.id, {
            symbol: "BTC",
            type: "crypto",
            quantity: 0.0425,
            price: euros(50000),
            quote: bitcoin,
        });

        const report = await refreshPrices(me.id, fetcher({ "coingecko:bitcoin": cents(5842000) }));

        expect(report).toStrictEqual({ changed: 1, confirmed: 0, missing: 0 });
        expect(await priceOf(held.id)).toStrictEqual({ price: 5842000, pricedAt: takenAt });
    });

    it("leaves holdings without a quote reference untouched", async () => {
        const me = await createUser();
        const held = await createHolding(me.id, { price: euros(100) });

        const report = await refreshPrices(me.id, fetcher({ "coingecko:bitcoin": cents(1) }));

        expect(report).toStrictEqual({ changed: 0, confirmed: 0, missing: 0 });
        expect((await priceOf(held.id))?.price).toBe(10000);
    });

    it("keeps the old price when the provider has no quote", async () => {
        const me = await createUser();
        const held = await createHolding(me.id, { symbol: "VWRL", price: euros(117.9), quote: vwrl });

        const report = await refreshPrices(me.id, fetcher({}));

        expect(report).toStrictEqual({ changed: 0, confirmed: 0, missing: 1 });
        expect((await priceOf(held.id))?.price).toBe(11790);
    });

    it("restamps a price that came back the same", async () => {
        const me = await createUser();
        const held = await createHolding(me.id, { symbol: "VWRL", price: euros(117.9), quote: vwrl });

        const report = await refreshPrices(me.id, fetcher({ "yahoo:VWRL.AS": cents(11790) }));

        expect(report).toStrictEqual({ changed: 0, confirmed: 1, missing: 0 });
        expect(await priceOf(held.id)).toStrictEqual({ price: 11790, pricedAt: takenAt });
    });

    it("refreshes only the given user's holdings", async () => {
        const me = await createUser();
        const someoneElse = await createUser("someone@lofit.test");
        const mine = await createHolding(me.id, { symbol: "BTC", type: "crypto", price: euros(50000), quote: bitcoin });
        const theirs = await createHolding(someoneElse.id, { symbol: "BTC", type: "crypto", price: euros(50000), quote: bitcoin });

        await refreshPrices(me.id, fetcher({ "coingecko:bitcoin": cents(5842000) }));

        expect((await priceOf(mine.id))?.price).toBe(5842000);
        expect((await priceOf(theirs.id))?.price).toBe(5000000);
    });
});

describe("POST /api/prices/refresh", () => {
    it("reports nothing to do when no holding has a quote reference", async () => {
        const me = await createUser();
        const mine = signedIn(me);
        await createHolding(me.id);

        const response = await mine.prices.refresh.$post();

        expect(response.status).toBe(200);
        expect(await response.json()).toStrictEqual({ changed: 0, confirmed: 0, missing: 0 });
    });
});
