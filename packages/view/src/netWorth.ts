import { addCents, cents, owesMoney } from "@lofit/domain";
import type { Group, NetWorthGroup, NetWorthItem } from "@lofit/domain";
import type { Slice } from "./donut";
import { groupColor, OTHER_COLOR, paletteFor } from "./palette";
import type { ColorToken } from "./palette";

export function kickerFor(entry: NetWorthGroup | undefined): string {
    if (!entry) return "Net worth";
    return owesMoney(entry.total) ? `${entry.group.name} outstanding` : entry.group.name;
}

export function centreLabel(entry: NetWorthGroup | undefined): string {
    return entry ? entry.group.name : "Assets";
}

export function netWorthSlices(
    parts: readonly NetWorthItem[],
    groups: readonly Group[],
    owed: boolean,
): Slice[] {
    const { slots, cap } = paletteFor(owed);
    const positionOf = (groupId: string) =>
        groups.find((group) => group.id === groupId)?.position ?? 0;

    const ranked = [...parts].sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
    const shown = new Set(ranked.slice(0, cap).map((item) => item.id));

    const colors = new Map<string, ColorToken>();
    for (const item of parts.filter((item) => shown.has(item.id))) {
        colors.set(
            item.id,
            item.id === item.groupId
                ? groupColor(positionOf(item.groupId), item.value < 0)
                : slots[colors.size % slots.length]!,
        );
    }

    const slices: Slice[] = ranked
        .filter((item) => shown.has(item.id))
        .map((item) => ({
            key: item.id,
            label: item.label,
            value: item.value,
            color: colors.get(item.id)!,
        }));

    const tail = ranked.slice(cap);
    const only = tail.length === 1 ? tail[0] : undefined;

    if (only) {
        slices.push({ key: only.id, label: only.label, value: only.value, color: OTHER_COLOR });
    } else if (tail.length > 1) {
        slices.push({
            key: "other",
            label: `Other (${tail.length})`,
            value: tail.reduce((sum, item) => addCents(sum, item.value), cents(0)),
            color: OTHER_COLOR,
        });
    }

    return slices;
}
