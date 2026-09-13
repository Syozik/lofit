import { quoteKey } from "@lofit/domain";
import type { Cents, QuoteRef } from "@lofit/domain";
import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "../db/client";
import { holdings } from "../db/schema";
import { fetchLiveQuotes } from "./live";

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
    const rows = await db.select().from(holdings).where(owned);

    const refs = rows.flatMap((row) => (row.quote ? [row.quote] : []));
    const quotes = refs.length > 0 ? await fetchQuotes(refs) : new Map<string, Quote>();

    const report: RefreshReport = { changed: 0, confirmed: 0, missing: 0 };
    for (const row of rows) {
        const quote = row.quote ? quotes.get(quoteKey(row.quote)) : undefined;
        if (!quote) {
            report.missing += 1;
            continue;
        }

        await db
            .update(holdings)
            .set({
                price: quote.price,
                nativePrice: quote.nativePrice,
                currency: quote.currency,
                pricedAt: quote.at,
            })
            .where(eq(holdings.id, row.id));

        if (quote.price === row.price) report.confirmed += 1;
        else report.changed += 1;
    }

    return report;
}
