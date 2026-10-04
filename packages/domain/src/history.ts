import { cents } from "./money";
import type { Cents } from "./money";
import type { Holding } from "./holding";

export interface PricePoint {
    day: string;
    price: Cents;
}

export type HistoryRange = "1m" | "6m" | "1y" | "5y" | "held";

export const HISTORY_RANGES: readonly HistoryRange[] = ["1m", "6m", "1y", "5y", "held"];

export const HISTORY_RANGE_LABELS: Record<HistoryRange, string> = {
    "1m": "1M",
    "6m": "6M",
    "1y": "1Y",
    "5y": "5Y",
    held: "Held",
};

const HISTORY_MONTHS: Record<Exclude<HistoryRange, "held">, number> = {
    "1m": 1,
    "6m": 6,
    "1y": 12,
    "5y": 60,
};

function monthsBefore(day: string, months: number): string {
    const date = new Date(`${day}T00:00:00Z`);
    date.setUTCMonth(date.getUTCMonth() - months);
    return date.toISOString().slice(0, 10);
}

export function historyIn(
    points: readonly PricePoint[],
    range: HistoryRange,
    heldSince: string,
): readonly PricePoint[] {
    const last = points[points.length - 1];
    if (!last) return points;

    const start = range === "held" ? heldSince : monthsBefore(last.day, HISTORY_MONTHS[range]);
    const after = points.findIndex((point) => point.day > start);
    if (after === -1) return points.slice(-1);

    return points.slice(Math.max(after - 1, 0));
}

export function unitCost(holding: Pick<Holding, "cost" | "quantity">): Cents {
    return cents(Math.round(holding.cost / holding.quantity));
}
