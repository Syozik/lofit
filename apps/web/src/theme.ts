import { useSyncExternalStore } from "react";

export type ThemePreference = "system" | "light" | "dark";

const KEY = "lofit-theme";
const media = window.matchMedia("(prefers-color-scheme: dark)");
const listeners = new Set<() => void>();

function read(): ThemePreference {
    try {
        const stored = localStorage.getItem(KEY);
        return stored === "light" || stored === "dark" ? stored : "system";
    } catch {
        return "system";
    }
}

let preference = read();

function apply(): void {
    const dark = preference === "dark" || (preference === "system" && media.matches);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute("content", dark ? "#12131a" : "#f6f7fc");
}

media.addEventListener("change", apply);
apply();

export function setThemePreference(next: ThemePreference): void {
    preference = next;
    try {
        if (next === "system") localStorage.removeItem(KEY);
        else localStorage.setItem(KEY, next);
    } catch (error) {
        console.warn("Could not remember the theme", error);
    }
    apply();
    listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function useThemePreference(): ThemePreference {
    return useSyncExternalStore(subscribe, () => preference);
}
