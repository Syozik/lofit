import { cents } from "@lofit/domain";
import type { Cents } from "@lofit/domain";

const ENDPOINT = "https://api.coingecko.com/api/v3/simple/price";

export async function fetchCoingeckoPrices(
    ids: readonly string[],
): Promise<Map<string, Cents>> {
    const prices = new Map<string, Cents>();
    if (ids.length === 0) return prices;

    const query = `ids=${encodeURIComponent(ids.join(","))}&vs_currencies=eur`;
    const response = await fetch(`${ENDPOINT}?${query}`, { headers: { accept: "application/json" } });
    if (!response.ok) return prices;

    const body = (await response.json()) as Record<string, { eur?: number }>;
    for (const [id, value] of Object.entries(body)) {
        if (typeof value.eur === "number") prices.set(id, cents(Math.round(value.eur * 100)));
    }

    return prices;
}
