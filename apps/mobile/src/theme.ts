import type { ColorToken } from "@lofit/view";

const tokens: Record<ColorToken, string> = {
    "accent-300": "#2f4f8c",
    "accent-400": "#4468c0",
    "accent-500": "#5b83e0",
    "accent-600": "#93b0f4",
    "accent-700": "#c2d4fb",
    "accent-2-400": "#b5afe8",
    "accent-2-600": "#7972a9",
    "neutral-600": "#7c8092",
    "neutral-700": "#d3d7e6",
    "neutral-800": "#e6e9f5",
    "neutral-900": "#f2f4fd",
};

export function tokenColor(token: ColorToken): string {
    return tokens[token];
}

export const colors = {
    bg: "#f6f7fc",
    surface: "#fdfdff",
    text: "#22242c",
    accent: "#3f66cf",
    accentStrong: "#2f4f8c",
    accentSoft: "#dde8fe",
    accentInk: "#16233f",
    danger: "#d1453b",
    divider: "rgba(34, 36, 44, 0.14)",
    hairline: "rgba(34, 36, 44, 0.07)",
    muted: "#7c8092",
    quiet: "#6e7284",
    subtle: "#8a8e9f",
    chip: "#e6e9f5",
};

export const fonts = {
    regular: "Geist_400Regular",
    medium: "Geist_500Medium",
    semibold: "Geist_600SemiBold",
};

export const space = {
    1: 2.8,
    2: 5.6,
    3: 8.4,
    4: 11.2,
    6: 16.8,
    8: 22.4,
};

export const radius = {
    sm: 4,
    md: 8,
    lg: 14,
};
