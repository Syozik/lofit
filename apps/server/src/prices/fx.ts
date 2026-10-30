import { cents, EURO } from "@lofit/domain";
import type { Cents } from "@lofit/domain";
import { and, asc, gte, inArray } from "drizzle-orm";
import { db } from "../db/client";
import { fxRates } from "../db/schema";
import { ensureRatesSince } from "./history";
import { perEuro } from "./rates";

const RECENT_DAYS = 14;

type Series = { days: string[]; rates: number[] };

export type Fx = {
    convert: (amount: Cents, from: string, to: string, day?: string) => Cents;
};

function daysAgo(days: number): string {
    return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

function rateIn(series: Series, day: string | undefined): number | undefined {
    const { days, rates } = series;
    if (days.length === 0) return undefined;
    if (!day) return rates[rates.length - 1];

    let low = 0;
    let high = days.length - 1;
    while (low < high) {
        const mid = Math.ceil((low + high) / 2);
        if (days[mid]! <= day) low = mid;
        else high = mid - 1;
    }
    return days[low]! <= day ? rates[low] : rates[0];
}

export async function loadFx(currencies: Iterable<string>, since?: string): Promise<Fx> {
    const wanted = [...new Set(currencies)].filter((currency) => currency !== EURO);
    const from = since && since < daysAgo(RECENT_DAYS) ? since : daysAgo(RECENT_DAYS);

    await Promise.all(wanted.map((currency) => perEuro(currency)));
    if (since) await Promise.all(wanted.map((currency) => ensureRatesSince(currency, since)));

    const rows =
        wanted.length === 0
            ? []
            : await db
                  .select()
                  .from(fxRates)
                  .where(and(inArray(fxRates.currency, wanted), gte(fxRates.day, from)))
                  .orderBy(asc(fxRates.day));

    const byCurrency = new Map<string, Series>();
    for (const row of rows) {
        const series = byCurrency.get(row.currency) ?? { days: [], rates: [] };
        series.days.push(row.day);
        series.rates.push(row.perEuro);
        byCurrency.set(row.currency, series);
    }

    const rate = (currency: string, day: string | undefined) =>
        currency === EURO ? 1 : rateIn(byCurrency.get(currency) ?? { days: [], rates: [] }, day);

    return {
        convert(amount, fromCurrency, toCurrency, day) {
            if (fromCurrency === toCurrency) return amount;
            const source = rate(fromCurrency, day);
            const target = rate(toCurrency, day);
            if (!source || !target) {
                console.warn(`No rate to convert ${fromCurrency} to ${toCurrency}`);
                return amount;
            }
            return cents(Math.round((amount / source) * target));
        },
    };
}
