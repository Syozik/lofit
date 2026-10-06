export type ColorToken =
    | "accent-300"
    | "accent-400"
    | "accent-500"
    | "accent-600"
    | "accent-700"
    | "accent-2-400"
    | "accent-2-600"
    | "neutral-600"
    | "neutral-700"
    | "neutral-800"
    | "neutral-900";

const SHADES: readonly ColorToken[] = ["accent-400", "accent-600", "accent-700"];

const GREYS: readonly ColorToken[] = ["neutral-700", "neutral-800"];

export const CATEGORY_COLORS: readonly ColorToken[] = [
    "accent-400",
    "accent-600",
    "accent-2-400",
    "accent-500",
    "accent-2-600",
];

export const OTHER_COLOR: ColorToken = "neutral-600";

export const UNTAGGED_COLOR: ColorToken = "neutral-700";

export const DIMMED_COLOR: ColorToken = "neutral-900";

const VISIBLE_CAP = 4;

export type Palette = {
    slots: readonly ColorToken[];
    cap: number;
};

export function paletteFor(owed: boolean): Palette {
    const slots = owed ? GREYS : SHADES;
    return { slots, cap: Math.min(VISIBLE_CAP, slots.length) };
}

export function groupColor(position: number, owed: boolean): ColorToken {
    if (owed) return GREYS[0]!;
    return CATEGORY_COLORS[position % CATEGORY_COLORS.length]!;
}

const RANKED: readonly ColorToken[] = ["accent-300", "accent-400", "accent-600", "accent-700"];

export function rankColor(rank: number, isOther: boolean): ColorToken {
    if (isOther) return OTHER_COLOR;
    return RANKED[Math.min(rank, RANKED.length - 1)]!;
}
