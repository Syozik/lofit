const SHADES = [
    "var(--color-accent-400)",
    "var(--color-accent-600)",
    "var(--color-accent-700)",
] as const;

const GREYS = ["var(--color-neutral-700)", "var(--color-neutral-800)"] as const;

const OWNED = [
    "var(--color-accent-400)",
    "var(--color-accent-600)",
    "var(--color-accent-2-400)",
    "var(--color-accent-500)",
    "var(--color-accent-2-600)",
] as const;

export const OTHER_COLOR = "var(--color-neutral-600)";

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
    return OWNED[position % OWNED.length]!;
}
