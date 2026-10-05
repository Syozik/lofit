import { cents } from "./money";
import type { Cents } from "./money";
import type { Holding } from "./holding";

export interface PricePoint {
    day: string;
    price: Cents;
}

export interface PriceHistory {
    currency: string;
    points: PricePoint[];
    perEuroWhenBought: number;
}

export type HistoryRange = "1d" | "1w" | "1m" | "6m" | "1y" | "5y" | "held" | "max" | "custom";

export const PRICE_RANGES: readonly HistoryRange[] = ["1w", "1m", "6m", "1y", "5y", "held", "custom"];

export const PORTFOLIO_RANGES: readonly HistoryRange[] = ["1d", "1w", "1m", "6m", "1y", "5y", "max", "custom"];

export const HISTORY_RANGE_LABELS: Record<HistoryRange, string> = {
    "1d": "1D",
    "1w": "1W",
    "1m": "1M",
    "6m": "6M",
    "1y": "1Y",
    "5y": "5Y",
    held: "Held",
    max: "Max",
    custom: "Custom",
};

export interface DayWindow {
    from: string;
    to: string;
}

function daysBefore(day: string, days: number): string {
    return new Date(Date.parse(`${day}T00:00:00Z`) - days * 86_400_000).toISOString().slice(0, 10);
}

function monthsBefore(day: string, months: number): string {
    const date = new Date(`${day}T00:00:00Z`);
    date.setUTCMonth(date.getUTCMonth() - months);
    return date.toISOString().slice(0, 10);
}

export function rangeWindow(
    range: HistoryRange,
    last: string,
    options: { heldSince?: string; custom?: DayWindow } = {},
): Partial<DayWindow> {
    switch (range) {
        case "1d":
            return { from: daysBefore(last, 1) };
        case "1w":
            return { from: daysBefore(last, 7) };
        case "1m":
            return { from: monthsBefore(last, 1) };
        case "6m":
            return { from: monthsBefore(last, 6) };
        case "1y":
            return { from: monthsBefore(last, 12) };
        case "5y":
            return { from: monthsBefore(last, 60) };
        case "held":
            return options.heldSince ? { from: options.heldSince } : {};
        case "max":
            return {};
        case "custom":
            return options.custom ?? {};
    }
}

export function pointsWithin<T>(
    points: readonly T[],
    dayOf: (point: T) => string,
    window: Partial<DayWindow>,
): readonly T[] {
    let end = points.length - 1;
    while (end >= 0 && window.to && dayOf(points[end] as T).slice(0, 10) > window.to) end -= 1;
    if (end === -1) return [];

    const from = window.from;
    const after = from ? points.findIndex((point) => dayOf(point) > from) : 0;
    const start = after === -1 || after > end ? end : Math.max(after - 1, 0);

    return points.slice(start, end + 1);
}

export function historyIn(
    points: readonly PricePoint[],
    range: HistoryRange,
    heldSince: string,
    custom?: DayWindow,
): readonly PricePoint[] {
    const last = points[points.length - 1];
    if (!last) return points;

    const options = custom ? { heldSince, custom } : { heldSince };
    return pointsWithin(points, (point) => point.day, rangeWindow(range, last.day, options));
}

export function unitCost(holding: Pick<Holding, "cost" | "quantity">, perEuro = 1): Cents {
    return cents(Math.round((holding.cost / holding.quantity) * perEuro));
}

export interface ValuePoint {
    at: string;
    value: Cents;
    invested: Cents;
}
