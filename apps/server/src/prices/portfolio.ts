import { cents, EURO, quoteKey } from "@lofit/domain";
import type { Cents, QuoteRef, ValuePoint } from "@lofit/domain";
import { and, asc, eq } from "drizzle-orm";
import { db } from "../db/client";
import { accounts, fxRates, holdings } from "../db/schema";
import { fetchCoingeckoIntraday } from "./coingecko";
import { priceHistory } from "./history";
import { perEuro } from "./rates";
import type { Tick } from "./yahoo";
import { fetchYahooIntraday } from "./yahoo";

const DAY_MS = 86_400_000;
const STEP_MS = 5 * 60 * 1000;
const TICKS_FRESH_MS = 5 * 60 * 1000;

interface Held {
    quantity: number;
    price: Cents;
    cost: Cents;
    heldSince: string;
    quote: QuoteRef | null;
}

async function heldIn(userId: string, groupId?: string): Promise<Held[]> {
    return db
        .select({
            quantity: holdings.quantity,
            price: holdings.price,
            cost: holdings.cost,
            heldSince: holdings.heldSince,
            quote: holdings.quote,
        })
        .from(holdings)
        .innerJoin(accounts, eq(accounts.id, holdings.accountId))
        .where(
            groupId
                ? and(eq(holdings.userId, userId), eq(accounts.groupId, groupId))
                : eq(holdings.userId, userId),
        );
}

function daysFrom(first: string, last: string): string[] {
    const days: string[] = [];
    for (let at = Date.parse(first); at <= Date.parse(last); at += DAY_MS) {
        days.push(new Date(at).toISOString().slice(0, 10));
    }
    return days;
}

function forwardFill<T extends { key: string | number; value: number }>(
    rows: readonly T[],
    keys: readonly (string | number)[],
    fallback: number,
): number[] {
    let index = 0;
    let current = rows[0]?.value ?? fallback;

    return keys.map((key) => {
        while (index < rows.length && (rows[index] as T).key <= key) {
            current = (rows[index] as T).value;
            index += 1;
        }
        return current;
    });
}

async function dailyUnitPrices(held: Held, days: readonly string[]): Promise<number[]> {
    const history = held.quote ? await priceHistory(held.quote, held.heldSince) : null;
    if (!history || history.points.length === 0) return days.map(() => held.price);

    const closes = forwardFill(
        history.points.map((point) => ({ key: point.day, value: point.price })),
        days,
        held.price,
    );
    if (history.currency === EURO) return closes;

    const rates = await db
        .select({ key: fxRates.day, value: fxRates.perEuro })
        .from(fxRates)
        .where(eq(fxRates.currency, history.currency))
        .orderBy(asc(fxRates.day));
    if (rates.length === 0) return days.map(() => held.price);

    const perEuro = forwardFill(rates, days, 1);
    return closes.map((close, index) => close / (perEuro[index] ?? 1));
}

export async function portfolioHistory(userId: string, groupId?: string): Promise<ValuePoint[]> {
    const held = await heldIn(userId, groupId);
    if (held.length === 0) return [];

    const today = new Date().toISOString().slice(0, 10);
    const first = held.reduce((earliest, row) => (row.heldSince < earliest ? row.heldSince : earliest), today);
    const days = daysFrom(first, today);
    const prices = await Promise.all(held.map((row) => dailyUnitPrices(row, days)));

    return days.map((day, index) => {
        let value = 0;
        let invested = 0;
        held.forEach((row, at) => {
            if (row.heldSince > day) return;
            value += row.quantity * (day === today ? row.price : (prices[at]?.[index] ?? row.price));
            invested += row.cost;
        });
        return { at: day, value: cents(Math.round(value)), invested: cents(invested) };
    });
}

const tickCache = new Map<string, { fetchedAt: number; ticks: Tick[] }>();

async function fetchTicks(ref: QuoteRef): Promise<Tick[]> {
    if (ref.source === "coingecko") return (await fetchCoingeckoIntraday(ref.id)) ?? [];

    const fetched = await fetchYahooIntraday(ref.symbol);
    if (!fetched) return [];

    const rate = await perEuro(fetched.currency);
    if (!rate) return [];

    return fetched.ticks.map((tick) => ({ at: tick.at, price: cents(Math.round(tick.price / rate)) }));
}

async function ticksFor(ref: QuoteRef): Promise<Tick[]> {
    const key = quoteKey(ref);
    const cached = tickCache.get(key);
    if (cached && Date.now() - cached.fetchedAt < TICKS_FRESH_MS) return cached.ticks;

    const ticks = await fetchTicks(ref);
    tickCache.set(key, { fetchedAt: Date.now(), ticks });
    return ticks;
}

export async function portfolioIntraday(userId: string, groupId?: string): Promise<ValuePoint[]> {
    const held = await heldIn(userId, groupId);
    if (held.length === 0) return [];

    const end = Math.floor(Date.now() / STEP_MS) * STEP_MS;
    const stamps: number[] = [];
    for (let at = end - DAY_MS; at <= end; at += STEP_MS) stamps.push(at);

    const prices = await Promise.all(
        held.map(async (row) => {
            const ticks = row.quote ? await ticksFor(row.quote) : [];
            return forwardFill(
                ticks.map((tick) => ({ key: tick.at, value: tick.price })),
                stamps,
                row.price,
            );
        }),
    );

    const invested = held.reduce((sum, row) => sum + row.cost, 0);

    return stamps.map((stamp, index) => {
        const value = held.reduce(
            (sum, row, at) => sum + row.quantity * (prices[at]?.[index] ?? row.price),
            0,
        );
        return { at: new Date(stamp).toISOString(), value: cents(Math.round(value)), invested: cents(invested) };
    });
}
