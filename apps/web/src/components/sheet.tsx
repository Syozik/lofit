import { useRef, useState } from "react";
import type { PointerEvent, ReactNode } from "react";
import { X } from "lucide-react";
import { useEscapeToClose } from "../sheets";
import { useDesktop } from "../useDesktop";

const CLOSE_DISTANCE = 96;
const CLOSE_SPEED = 0.6;
const SETTLE_MS = 200;

type Props = {
    label: string;
    onClose: () => void;
    children: ReactNode;
};

export function Sheet({ label, onClose, children }: Props) {
    const [offset, setOffset] = useState(0);
    const [settling, setSettling] = useState(false);
    const start = useRef<{ y: number; at: number } | null>(null);
    const desktop = useDesktop();

    useEscapeToClose(onClose);

    function grab(event: PointerEvent<HTMLDivElement>) {
        start.current = { y: event.clientY, at: event.timeStamp };
        event.currentTarget.setPointerCapture(event.pointerId);
        setSettling(false);
    }

    function pull(event: PointerEvent<HTMLDivElement>) {
        if (!start.current) return;
        setOffset(Math.max(0, event.clientY - start.current.y));
    }

    function release(event: PointerEvent<HTMLDivElement>) {
        const started = start.current;
        start.current = null;
        if (!started) return;

        const distance = Math.max(0, event.clientY - started.y);
        const speed = distance / Math.max(event.timeStamp - started.at, 1);
        setSettling(true);

        if (distance > CLOSE_DISTANCE || speed > CLOSE_SPEED) {
            setOffset(window.innerHeight);
            window.setTimeout(onClose, SETTLE_MS);
        } else {
            setOffset(0);
        }
    }

    function cancel() {
        start.current = null;
        setSettling(true);
        setOffset(0);
    }

    const transition = settling ? `${SETTLE_MS}ms ease-out` : "none";

    return (
        <div className="sheet-layer">
            <button
                className="sheet-scrim"
                aria-label="Close"
                onClick={onClose}
                style={{ opacity: Math.max(0, 1 - offset / 400), transition: `opacity ${transition}` }}
            />

            <div
                className="sheet"
                role="dialog"
                aria-label={label}
                style={
                    offset > 0 || settling
                        ? { transform: `translateY(${offset}px)`, transition: `transform ${transition}` }
                        : undefined
                }
            >
                <div
                    className="sheet-grip"
                    onPointerDown={grab}
                    onPointerMove={pull}
                    onPointerUp={release}
                    onPointerCancel={cancel}
                />
                {desktop && (
                    <button className="btn btn-icon sheet-close" aria-label="Close" onClick={onClose}>
                        <X size={18} strokeWidth={1.5} aria-hidden />
                    </button>
                )}
                {children}
            </div>
        </div>
    );
}
