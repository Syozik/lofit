import { quoteKey, toBase } from "@lofit/domain";
import type { Cents, QuoteRef } from "@lofit/domain";
import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "../db/client";
import { holdings, users } from "../db/schema";
import { fetchLiveQuotes } from "./live";
import { perBase } from "./rates";

export interface Quote {
    price: Cents;
    nativePrice: Cents;
    currency: string;
    at: Date;
}

export type QuoteFetcher = (refs: readonly QuoteRef[]) => Promise<Map<string, Quote>>;

export interface RefreshReport {
    changed: number;
    confirmed: number;
    missing: number;
}

export async function refreshPrices(
    userId?: string,
    fetchQuotes: QuoteFetcher = fetchLiveQuotes,
): Promise<RefreshReport> {
    const owned = userId ? and(isNotNull(holdings.quote), eq(holdings.userId, userId)) : isNotNull(holdings.quote);
    const rows = await db
        .select({ id: holdings.id, quote: holdings.quote, price: holdings.price, base: users.currency })
        .from(holdings)
        .innerJoin(users, eq(users.id, holdings.userId))
        .where(owned);

    const refs = rows.flatMap((row) => (row.quote ? [row.quote] : []));
    const quotes = refs.length > 0 ? await fetchQuotes(refs) : new Map<string, Quote>();
    const rates = new Map<string, number | undefined>();

    const report: RefreshReport = { changed: 0, confirmed: 0, missing: 0 };
    for (const row of rows) {
        const quote = row.quote ? quotes.get(quoteKey(row.quote)) : undefined;
        if (!quote) {
            report.missing += 1;
            continue;
        }

        const pair = `${quote.currency}:${row.base}`;
        if (!rates.has(pair)) rates.set(pair, await perBase(quote.currency, row.base));
        const rate = rates.get(pair);
        if (!rate) {
            report.missing += 1;
            continue;
        }

        const price = quote.currency === row.base ? quote.nativePrice : toBase(quote.nativePrice, rate);
        await db
            .update(holdings)
            .set({
                price,
                nativePrice: quote.nativePrice,
                currency: quote.currency,
                pricedAt: quote.at,
            })
            .where(eq(holdings.id, row.id));

        if (price === row.price) report.confirmed += 1;
        else report.changed += 1;
    }

    return report;
}
