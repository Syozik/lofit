import { holdingGain, holdingValue } from "./holding";
import type { Holding } from "./holding";
import { cents } from "./money";
import type { Cents } from "./money";
import type { Delta } from "./snapshot";

export interface Share {
    key: string;
    label: string;
    value: Cents;
    pct: number;
}

export function allocation(holdings: readonly Holding[], visible = 4): Share[] {
    const bySymbol = new Map<string, number>();
    for (const holding of holdings) {
        bySymbol.set(holding.symbol, (bySymbol.get(holding.symbol) ?? 0) + holdingValue(holding));
    }

    const total = [...bySymbol.values()].reduce((sum, value) => sum + value, 0);
    const pct = (value: number) => (total === 0 ? 0 : (value / total) * 100);
    const ranked = [...bySymbol]
        .map(([symbol, value]) => ({ key: symbol, label: symbol, value: cents(value), pct: pct(value) }))
        .sort((one, other) => other.value - one.value);

    if (ranked.length <= visible + 1) return ranked;

    const rest = ranked.slice(visible).reduce((sum, share) => sum + share.value, 0);
    return [
        ...ranked.slice(0, visible),
        { key: "other", label: `${ranked.length - visible} more`, value: cents(rest), pct: pct(rest) },
    ];
}

export interface HoldingGain {
    key: string;
    label: string;
    gain: Delta;
}

export function gainsBySymbol(holdings: readonly Holding[]): HoldingGain[] {
    const bySymbol = new Map<string, { cost: number; value: number }>();
    for (const holding of holdings) {
        if (holding.cost <= 0) continue;
        const entry = bySymbol.get(holding.symbol) ?? { cost: 0, value: 0 };
        entry.cost += holding.cost;
        entry.value += holdingValue(holding);
        bySymbol.set(holding.symbol, entry);
    }

    return [...bySymbol]
        .map(([symbol, entry]) => ({
            key: symbol,
            label: symbol,
            gain: holdingGain({ quantity: 1, price: cents(entry.value), cost: cents(entry.cost) }),
        }))
        .sort((one, other) => other.gain.pct - one.gain.pct);
}

export function portfolioGain(holdings: readonly Holding[]): Delta | undefined {
    const costed = holdings.filter((holding) => holding.cost > 0);
    if (costed.length === 0) return undefined;

    const cost = costed.reduce((sum, holding) => sum + holding.cost, 0);
    const value = costed.reduce((sum, holding) => sum + holdingValue(holding), 0);
    return holdingGain({ quantity: 1, price: cents(value), cost: cents(cost) });
}
