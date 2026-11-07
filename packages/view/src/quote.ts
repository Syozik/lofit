import type { AssetType, QuoteRef } from "@lofit/domain";

export function quoteTicker(quote: QuoteRef | undefined): string {
    if (!quote) return "";
    return quote.source === "coingecko" ? quote.id : quote.symbol;
}

export function quoteFor(type: AssetType, ticker: string): QuoteRef | null {
    const wanted = ticker.trim();
    if (!wanted) return null;
    return type === "crypto" ? { source: "coingecko", id: wanted.toLowerCase() } : { source: "yahoo", symbol: wanted.toUpperCase() };
}

export function followsSymbol(holding: { symbol: string; quote?: QuoteRef }): boolean {
    return holding.quote?.source === "yahoo" && holding.quote.symbol === holding.symbol;
}
