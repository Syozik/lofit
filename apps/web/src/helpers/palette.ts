const SHADES = [
    "var(--color-accent-400)",
    "var(--color-accent-600)",
    "var(--color-accent-700)",
] as const;

const GREYS = ["var(--color-neutral-700)", "var(--color-neutral-800)"] as const;

export const CATEGORY_COLORS = [
    "var(--color-accent-400)",
    "var(--color-accent-600)",
    "var(--color-accent-2-400)",
    "var(--color-accent-500)",
    "var(--color-accent-2-600)",
] as const;

export const OTHER_COLOR = "var(--color-neutral-600)";

export const UNTAGGED_COLOR = "var(--color-neutral-700)";

const VISIBLE_CAP = 4;

type Palette = {
    slots: readonly string[];
    cap: number;
};

export function paletteFor(owed: boolean): Palette {
    const slots = owed ? GREYS : SHADES;
    return { slots, cap: Math.min(VISIBLE_CAP, slots.length) };
}

export function groupColor(position: number, owed: boolean): string {
    if (owed) return GREYS[0];
    return CATEGORY_COLORS[position % CATEGORY_COLORS.length]!;
}

const RANKED = [
    "var(--color-accent-300)",
    "var(--color-accent-400)",
    "var(--color-accent-600)",
    "var(--color-accent-700)",
] as const;

export function rankColor(rank: number, isOther: boolean): string {
    if (isOther) return OTHER_COLOR;
    return RANKED[Math.min(rank, RANKED.length - 1)]!;
}
