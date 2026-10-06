import { useSyncExternalStore } from "react";

const media = window.matchMedia("(min-width: 1024px)");

function subscribe(onChange: () => void) {
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
}

export function useDesktop(): boolean {
    return useSyncExternalStore(subscribe, () => media.matches);
}
