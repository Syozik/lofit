import { cents } from "@lofit/domain";
import type { Cents } from "@lofit/domain";
import type { Close, Tick } from "./yahoo";

const API = "https://api.coingecko.com/api/v3";

export async function fetchCoingeckoPrices(
    ids: readonly string[],
): Promise<Map<string, Cents>> {
    const prices = new Map<string, Cents>();
    if (ids.length === 0) return prices;

    const query = `ids=${encodeURIComponent(ids.join(","))}&vs_currencies=eur`;
    const response = await fetch(`${API}/simple/price?${query}`, { headers: { accept: "application/json" } });
    if (!response.ok) return prices;

    const body = (await response.json()) as Record<string, { eur?: number }>;
    for (const [id, value] of Object.entries(body)) {
        if (typeof value.eur === "number") prices.set(id, cents(Math.round(value.eur * 100)));
    }

    return prices;
}

export async function fetchCoingeckoHistory(id: string): Promise<Close[] | undefined> {
    const response = await fetch(
        `${API}/coins/${encodeURIComponent(id)}/market_chart?vs_currency=eur&days=365&interval=daily`,
        { headers: { accept: "application/json" } },
    );
    if (!response.ok) return undefined;

    const body = (await response.json()) as { prices?: [number, number][] };
    const byDay = new Map<string, Cents>();
    for (const [stamp, value] of body.prices ?? []) {
        byDay.set(new Date(stamp).toISOString().slice(0, 10), cents(Math.round(value * 100)));
    }

    return [...byDay].map(([day, close]) => ({ day, close }));
}

export async function fetchCoingeckoIntraday(id: string): Promise<Tick[] | undefined> {
    const response = await fetch(
        `${API}/coins/${encodeURIComponent(id)}/market_chart?vs_currency=eur&days=1`,
        { headers: { accept: "application/json" } },
    );
    if (!response.ok) return undefined;

    const body = (await response.json()) as { prices?: [number, number][] };
    return (body.prices ?? []).map(([at, value]) => ({ at, price: cents(Math.round(value * 100)) }));
}
