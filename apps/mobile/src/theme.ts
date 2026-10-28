import type { ColorToken } from "@lofit/view";
import { useMemo } from "react";
import { useColorScheme } from "react-native";

export type Scheme = "light" | "dark";

const tokens: Record<Scheme, Record<ColorToken, string>> = {
    light: {
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
    },
    dark: {
        "accent-300": "#c2d4fb",
        "accent-400": "#93b0f4",
        "accent-500": "#6f92ec",
        "accent-600": "#4468c0",
        "accent-700": "#2f4f8c",
        "accent-2-400": "#b5afe8",
        "accent-2-600": "#7972a9",
        "neutral-600": "#8a8ea0",
        "neutral-700": "#5c6070",
        "neutral-800": "#474b59",
        "neutral-900": "#1d1f27",
    },
};

export const lightColors = {
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
    onAccent: "#ffffff",
    onAccentStrong: "#ffffff",
    accentWash: "rgba(63, 102, 207, 0.14)",
    accentTint: "rgba(63, 102, 207, 0.12)",
    accentFill: "rgba(63, 102, 207, 0.09)",
    dangerEdge: "rgba(209, 69, 59, 0.35)",
    scrim: "rgba(22, 24, 32, 0.35)",
    veil: "rgba(253, 253, 255, 0.8)",
    veilStrong: "rgba(253, 253, 255, 0.85)",
    gain: "#4468c0",
    toastAction: "#93b0f4",
};

export type Colors = typeof lightColors;

export const darkColors: Colors = {
    bg: "#12131a",
    surface: "#1a1c25",
    text: "#e8eaf3",
    accent: "#6f92ec",
    accentStrong: "#c2d4fb",
    accentSoft: "#223760",
    accentInk: "#dde8fe",
    danger: "#e5675d",
    divider: "rgba(232, 234, 243, 0.12)",
    hairline: "rgba(232, 234, 243, 0.06)",
    muted: "#8a8ea0",
    quiet: "#a3a7b8",
    subtle: "#7d8194",
    chip: "#2a2d38",
    onAccent: "#ffffff",
    onAccentStrong: "#16233f",
    accentWash: "rgba(111, 146, 236, 0.16)",
    accentTint: "rgba(111, 146, 236, 0.14)",
    accentFill: "rgba(111, 146, 236, 0.12)",
    dangerEdge: "rgba(229, 103, 93, 0.45)",
    scrim: "rgba(0, 0, 0, 0.6)",
    veil: "rgba(26, 28, 37, 0.8)",
    veilStrong: "rgba(26, 28, 37, 0.85)",
    gain: "#93b0f4",
    toastAction: "#4468c0",
};

export const palettes: Record<Scheme, Colors> = { light: lightColors, dark: darkColors };

export function useScheme(): Scheme {
    return useColorScheme() === "dark" ? "dark" : "light";
}

export function useTheme() {
    const scheme = useScheme();
    return useMemo(
        () => ({
            scheme,
            colors: palettes[scheme],
            tokenColor: (token: ColorToken): string => tokens[scheme][token],
        }),
        [scheme],
    );
}

const built = new WeakMap<object, Partial<Record<Scheme, unknown>>>();

export function useStyles<T>(factory: (colors: Colors) => T): T {
    const scheme = useScheme();
    let cache = built.get(factory);
    if (!cache) {
        cache = {};
        built.set(factory, cache);
    }
    if (!(scheme in cache)) cache[scheme] = factory(palettes[scheme]);
    return cache[scheme] as T;
}

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
