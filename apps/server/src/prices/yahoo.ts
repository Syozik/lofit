import { cents } from "@lofit/domain";
import type { Cents } from "@lofit/domain";

const ENDPOINT = "https://query1.finance.yahoo.com/v8/finance/chart";

type ChartResponse = {
    chart?: {
        result?: { meta?: { regularMarketPrice?: number; currency?: string } }[];
    };
};

export async function fetchYahooPrice(
    symbol: string,
): Promise<{ price: Cents; currency: string } | undefined> {
    const response = await fetch(`${ENDPOINT}/${encodeURIComponent(symbol)}?interval=1d&range=1d`, {
        headers: { accept: "application/json", "user-agent": "lofit/0.1" },
    });
    if (!response.ok) return undefined;

    const meta = ((await response.json()) as ChartResponse).chart?.result?.[0]?.meta;
    if (typeof meta?.regularMarketPrice !== "number" || !meta.currency) return undefined;

    return {
        price: cents(Math.round(meta.regularMarketPrice * 100)),
        currency: meta.currency.toUpperCase(),
    };
}
