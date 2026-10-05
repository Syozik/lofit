import { useRef, useState } from "react";

export const ACTION_WIDTH = 56;

const DRAG_SLOP = 4;

type Options = {
    enabled: boolean;
    actions?: number;
    onTap?: () => void;
};

export function useSwipe({ enabled, actions = 1, onTap }: Options) {
    const width = ACTION_WIDTH * actions;

    const [offset, setOffset] = useState(0);
    const [dragging, setDragging] = useState(false);
    const drag = useRef<{ x: number; y: number; from: number } | null>(null);

    function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
        if (!enabled) return;
        drag.current = { x: event.clientX, y: event.clientY, from: offset };
    }

    function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
        const started = drag.current;
        if (!started) return;

        const dx = event.clientX - started.x;
        const dy = event.clientY - started.y;

        if (!dragging) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) < DRAG_SLOP) return;
            if (Math.abs(dy) > Math.abs(dx)) {
                drag.current = null;
                return;
            }
            setDragging(true);
            event.currentTarget.setPointerCapture(event.pointerId);
        }

        setOffset(Math.max(-width, Math.min(0, started.from + dx)));
    }

    function onPointerUp() {
        const started = drag.current;
        drag.current = null;

        if (dragging) {
            setDragging(false);
            setOffset(offset < -width / 2 ? -width : 0);
            return;
        }
        if (!started) return;

        if (offset !== 0) {
            setOffset(0);
            return;
        }
        onTap?.();
    }

    function onPointerCancel() {
        drag.current = null;
        if (!dragging) return;
        setDragging(false);
        setOffset(offset < -width / 2 ? -width : 0);
    }

    return {
        offset,
        dragging,
        width,
        handlers: {
            onPointerDown,
            onPointerMove,
            onPointerUp,
            onPointerCancel,
        },
    };
}
