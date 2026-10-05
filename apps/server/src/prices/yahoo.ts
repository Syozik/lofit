import { cents } from "@lofit/domain";
import type { Cents } from "@lofit/domain";

const ENDPOINT = "https://query1.finance.yahoo.com/v8/finance/chart";

type ChartResponse = {
    chart?: {
        result?: {
            meta?: { regularMarketPrice?: number; currency?: string; gmtoffset?: number };
            timestamp?: number[];
            indicators?: { quote?: { close?: (number | null)[] }[] };
        }[];
    };
};

export interface Close {
    day: string;
    close: Cents;
}

async function fetchChart(symbol: string, query: string) {
    const response = await fetch(`${ENDPOINT}/${encodeURIComponent(symbol)}?${query}`, {
        headers: { accept: "application/json", "user-agent": "lofit/0.1" },
    });
    if (!response.ok) return undefined;

    return ((await response.json()) as ChartResponse).chart?.result?.[0];
}

export async function fetchYahooPrice(
    symbol: string,
): Promise<{ price: Cents; currency: string } | undefined> {
    const meta = (await fetchChart(symbol, "interval=1d&range=1d"))?.meta;
    if (typeof meta?.regularMarketPrice !== "number" || !meta.currency) return undefined;

    return {
        price: cents(Math.round(meta.regularMarketPrice * 100)),
        currency: meta.currency.toUpperCase(),
    };
}

export async function fetchYahooHistory(
    symbol: string,
    since?: string,
): Promise<{ currency: string; closes: Close[] } | undefined> {
    const window = since
        ? `period1=${Math.floor(Date.parse(since) / 1000)}&period2=${Math.floor(Date.now() / 1000)}`
        : "range=10y";
    const result = await fetchChart(symbol, `interval=1d&${window}`);
    const currency = result?.meta?.currency;
    if (!result || !currency) return undefined;

    const offset = result.meta?.gmtoffset ?? 0;
    const values = result.indicators?.quote?.[0]?.close ?? [];
    const closes = (result.timestamp ?? []).flatMap((stamp, index) => {
        const value = values[index];
        if (typeof value !== "number") return [];
        return [{
            day: new Date((stamp + offset) * 1000).toISOString().slice(0, 10),
            close: cents(Math.round(value * 100)),
        }];
    });

    return { currency: currency.toUpperCase(), closes };
}

export interface Tick {
    at: number;
    price: Cents;
}

export async function fetchYahooIntraday(
    symbol: string,
): Promise<{ currency: string; ticks: Tick[] } | undefined> {
    const result = await fetchChart(symbol, "interval=5m&range=5d");
    const currency = result?.meta?.currency;
    if (!result || !currency) return undefined;

    const values = result.indicators?.quote?.[0]?.close ?? [];
    const ticks = (result.timestamp ?? []).flatMap((stamp, index) => {
        const value = values[index];
        if (typeof value !== "number") return [];
        return [{ at: stamp * 1000, price: cents(Math.round(value * 100)) }];
    });

    return { currency: currency.toUpperCase(), ticks };
}
