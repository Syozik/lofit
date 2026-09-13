import { EURO, quoteKey, toEuros } from "@lofit/domain";
import { fetchCoingeckoPrices } from "./coingecko";
import { perEuro } from "./rates";
import type { Quote, QuoteFetcher } from "./refresh";
import { fetchYahooPrice } from "./yahoo";

export const fetchLiveQuotes: QuoteFetcher = async (refs) => {
    const quotes = new Map<string, Quote>();
    const at = new Date();

    const ids = refs.flatMap((ref) => (ref.source === "coingecko" ? [ref.id] : []));
    for (const [id, price] of await fetchCoingeckoPrices(ids)) {
        quotes.set(quoteKey({ source: "coingecko", id }), {
            price,
            nativePrice: price,
            currency: EURO,
            at,
        });
    }

    for (const ref of refs) {
        if (ref.source !== "yahoo") continue;

        const quote = await fetchYahooPrice(ref.symbol);
        if (!quote) continue;

        const rate = await perEuro(quote.currency);
        if (!rate) {
            console.warn(`Skipped ${ref.symbol}: no euro rate for ${quote.currency}`);
            continue;
        }

        quotes.set(quoteKey(ref), {
            price: toEuros(quote.price, rate),
            nativePrice: quote.price,
            currency: quote.currency,
            at,
        });
    }

    return quotes;
};
