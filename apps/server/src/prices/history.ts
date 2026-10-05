import { EURO, quoteKey } from "@lofit/domain";
import type { PriceHistory, QuoteRef } from "@lofit/domain";
import { and, asc, desc, eq, lte, max, min, sql } from "drizzle-orm";
import { db } from "../db/client";
import { fxRates, priceCloses, priceSeries } from "../db/schema";
import { fetchCoingeckoHistory } from "./coingecko";
import { fetchEcbHistory } from "./ecb";
import type { Close } from "./yahoo";
import { fetchYahooHistory } from "./yahoo";

const STALE_AFTER_MS = 6 * 60 * 60 * 1000;
const OVERLAP_DAYS = 7;
const BATCH = 5000;

const inFlight = new Map<string, Promise<void>>();
const backfilled = new Set<string>();

function daysBefore(day: string, days: number): string {
    return new Date(Date.parse(day) - days * 86_400_000).toISOString().slice(0, 10);
}

async function store<T>(rows: readonly T[], insert: (chunk: T[]) => Promise<unknown>): Promise<void> {
    for (let start = 0; start < rows.length; start += BATCH) {
        await insert(rows.slice(start, start + BATCH));
    }
}

async function fetchCloses(
    ref: QuoteRef,
    since?: string,
): Promise<{ currency: string; closes: Close[] } | undefined> {
    if (ref.source === "yahoo") return fetchYahooHistory(ref.symbol, since);

    const closes = await fetchCoingeckoHistory(ref.id);
    return closes && { currency: EURO, closes };
}

async function topUp(ref: QuoteRef): Promise<void> {
    const key = quoteKey(ref);

    const [series] = await db.select().from(priceSeries).where(eq(priceSeries.key, key));
    if (series && Date.now() - series.fetchedAt.getTime() < STALE_AFTER_MS) return;

    const [latest] = await db
        .select({ day: max(priceCloses.day) })
        .from(priceCloses)
        .where(eq(priceCloses.key, key));

    const fetched = await fetchCloses(ref, latest?.day ? daysBefore(latest.day, OVERLAP_DAYS) : undefined);
    if (!fetched) return;

    await db.transaction(async (tx) => {
        await tx
            .insert(priceSeries)
            .values({ key, currency: fetched.currency, fetchedAt: new Date() })
            .onConflictDoUpdate({
                target: priceSeries.key,
                set: { currency: fetched.currency, fetchedAt: new Date() },
            });

        await store(fetched.closes, (chunk) =>
            tx
                .insert(priceCloses)
                .values(chunk.map((close) => ({ key, ...close })))
                .onConflictDoUpdate({
                    target: [priceCloses.key, priceCloses.day],
                    set: { close: sql`excluded.close` },
                }),
        );
    });
}

async function ensureRatesSince(currency: string, day: string): Promise<void> {
    if (currency === EURO || backfilled.has(currency) || !/^[A-Z]{3}$/.test(currency)) return;

    const [earliest] = await db
        .select({ day: min(fxRates.day) })
        .from(fxRates)
        .where(eq(fxRates.currency, currency));
    if (earliest?.day && earliest.day <= daysBefore(day, -OVERLAP_DAYS)) return;

    backfilled.add(currency);
    const rows = await fetchEcbHistory(currency);
    await store(rows, (chunk) =>
        db
            .insert(fxRates)
            .values(chunk.map((row) => ({ currency, ...row })))
            .onConflictDoNothing(),
    );
}

async function rateOn(currency: string, day: string): Promise<number | undefined> {
    if (currency === EURO) return 1;

    const [before] = await db
        .select({ perEuro: fxRates.perEuro })
        .from(fxRates)
        .where(and(eq(fxRates.currency, currency), lte(fxRates.day, day)))
        .orderBy(desc(fxRates.day))
        .limit(1);
    if (before) return before.perEuro;

    const [after] = await db
        .select({ perEuro: fxRates.perEuro })
        .from(fxRates)
        .where(eq(fxRates.currency, currency))
        .orderBy(asc(fxRates.day))
        .limit(1);
    return after?.perEuro;
}

export async function priceHistory(ref: QuoteRef, heldSince: string): Promise<PriceHistory | null> {
    const key = quoteKey(ref);

    let pending = inFlight.get(key);
    if (!pending) {
        pending = topUp(ref).finally(() => inFlight.delete(key));
        inFlight.set(key, pending);
    }
    await pending;

    const [series] = await db.select().from(priceSeries).where(eq(priceSeries.key, key));
    if (!series) return null;

    const closes = await db
        .select({ day: priceCloses.day, price: priceCloses.close })
        .from(priceCloses)
        .where(eq(priceCloses.key, key))
        .orderBy(asc(priceCloses.day));

    await ensureRatesSince(series.currency, heldSince);
    const perEuro = await rateOn(series.currency, heldSince);
    if (!perEuro) return null;

    return { currency: series.currency, points: closes, perEuroWhenBought: perEuro };
}
