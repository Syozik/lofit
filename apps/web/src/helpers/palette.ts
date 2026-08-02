import type { GroupKey } from "@lofit/domain";

// The design's ramps: assets ride the accent scale, debt the neutral one.
const SHADES = [
    "var(--color-accent-400)",
    "var(--color-accent-600)",
    "var(--color-accent-700)",
] as const;

const GREYS = ["var(--color-neutral-700)", "var(--color-neutral-800)"] as const;

export const OTHER_COLOR = "var(--color-neutral-600)";

const GROUP_COLORS: Record<Exclude<GroupKey, "all">, string> = {
    cash: "var(--color-accent-400)",
    inv: "var(--color-accent-600)",
    debt: "var(--color-neutral-700)",
};

const VISIBLE_CAP = 4;

type Palette = {
    slots: readonly string[];
    cap: number;
};

export function paletteFor(group: GroupKey): Palette {
    const slots = group === "debt" ? GREYS : SHADES;
    return { slots, cap: Math.min(VISIBLE_CAP, slots.length) };
}

export function groupColor(group: GroupKey): string {
    return group === "all" ? OTHER_COLOR : GROUP_COLORS[group];
}
