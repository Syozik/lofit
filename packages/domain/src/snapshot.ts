import { ALL_GROUPS } from "./group";
import type { Scope } from "./group";
import { cents, sumCents } from "./money";
import type { Cents } from "./money";

export interface GroupAmount {
    groupId: string;
    amount: Cents;
}

export interface Snapshot {
    period: string;
    groups: readonly GroupAmount[];
}

export function snapshotNet(snapshot: Snapshot): Cents {
    return sumCents(snapshot.groups.map((entry) => entry.amount));
}

export function amountIn(snapshot: Snapshot, groupId: string): Cents {
    return snapshot.groups.find((entry) => entry.groupId === groupId)?.amount ?? cents(0);
}

export function seriesFor(snapshots: readonly Snapshot[], scope: Scope): readonly Cents[] {
    return snapshots.map((snapshot) =>
        scope === ALL_GROUPS ? snapshotNet(snapshot) : amountIn(snapshot, scope),
    );
}

export interface Delta {
    amount: Cents;
    pct: number;
    favourable: boolean;
}

export function deltaAt(values: readonly Cents[], index: number): Delta | undefined {
    const current = values[index];
    const previous = values[index - 1];
    if (current === undefined || previous === undefined) return undefined;

    const amount = cents(current - previous);

    return {
        amount,
        pct: previous === 0 ? 0 : Math.round((amount / Math.abs(previous)) * 10000) / 100,
        favourable: amount >= 0,
    };
}

export type RangeKey = "3m" | "6m" | "1y" | "all";

export const RANGE_ORDER: readonly RangeKey[] = ["3m", "6m", "1y", "all"];

export const RANGE_LABELS: Record<RangeKey, string> = {
    "3m": "3M",
    "6m": "6M",
    "1y": "1Y",
    all: "All",
};

const RANGE_MONTHS: Record<RangeKey, number | undefined> = {
    "3m": 3,
    "6m": 6,
    "1y": 12,
    all: undefined,
};

export function inRange<T>(entries: readonly T[], range: RangeKey): readonly T[] {
    const months = RANGE_MONTHS[range];
    return months === undefined ? entries : entries.slice(-months);
}
