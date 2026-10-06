import { useEffect, useEffectEvent } from "react";

const open: (() => void)[] = [];

function closeTop(event: KeyboardEvent) {
    if (event.key === "Escape") open[open.length - 1]?.();
}

export function isSheetOpen(): boolean {
    return open.length > 0;
}

export function useEscapeToClose(onClose: () => void) {
    const close = useEffectEvent(onClose);

    useEffect(() => {
        const entry = () => close();
        open.push(entry);
        if (open.length === 1) window.addEventListener("keydown", closeTop);
        return () => {
            open.splice(open.indexOf(entry), 1);
            if (open.length === 0) window.removeEventListener("keydown", closeTop);
        };
    }, []);
}
