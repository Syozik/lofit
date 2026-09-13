export const QUOTE_SOURCES = ["yahoo", "coingecko"] as const;

export type QuoteSource = (typeof QUOTE_SOURCES)[number];

export type QuoteRef =
    | { source: "yahoo"; symbol: string }
    | { source: "coingecko"; id: string };

export function quoteKey(ref: QuoteRef): string {
    return ref.source === "yahoo" ? `yahoo:${ref.symbol}` : `coingecko:${ref.id}`;
}
