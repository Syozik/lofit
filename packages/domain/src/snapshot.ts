import { ALL_GROUPS } from "./group";
import type { Scope } from "./group";
import { cents, sumCents } from "./money";
import type { Cents } from "./money";

export interface GroupAmount {
    groupId: string;
    amount: Cents;
}

export interface Snapshot {
    day: string;
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

export interface SnapshotPoint {
    at: string;
    value: Cents;
}

export function snapshotPoints(snapshots: readonly Snapshot[], scope: Scope): SnapshotPoint[] {
    const values = seriesFor(snapshots, scope);
    return snapshots.map((snapshot, index) => ({ at: snapshot.day, value: values[index] ?? cents(0) }));
}

export function lastBefore(snapshots: readonly Snapshot[], day: string): Snapshot | undefined {
    return snapshots.filter((snapshot) => snapshot.day < day).at(-1);
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
