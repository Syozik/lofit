import { HISTORY_RANGE_LABELS } from "@lofit/domain";
import type { DayWindow, HistoryRange } from "@lofit/domain";
import { useEffect, useRef } from "react";

type Props = {
    ranges: readonly HistoryRange[];
    active: HistoryRange;
    onSelect: (range: HistoryRange) => void;
    custom: DayWindow;
    onCustom: (window: DayWindow) => void;
    bounds: DayWindow;
};

export function RangePicker({ ranges, active, onSelect, custom, onCustom, bounds }: Props) {
    const row = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (active === "custom") row.current?.scrollTo({ left: row.current.scrollWidth, behavior: "smooth" });
    }, [active]);

    return (
        <div ref={row} className="ranges range-picker">
            {ranges.map((option) => (
                <button
                    key={option}
                    className={`tag range-chip ${active === option ? "selected" : ""}`}
                    onClick={() => onSelect(option)}
                >
                    {HISTORY_RANGE_LABELS[option]}
                </button>
            ))}

            {active === "custom" && (
                <span className="range-custom">
                    <input
                        className="range-date"
                        type="date"
                        aria-label="From"
                        min={bounds.from}
                        max={custom.to}
                        value={custom.from}
                        onChange={(event) => event.target.value && onCustom({ ...custom, from: event.target.value })}
                    />
                    <span className="range-to">–</span>
                    <input
                        className="range-date"
                        type="date"
                        aria-label="To"
                        min={custom.from}
                        max={bounds.to}
                        value={custom.to}
                        onChange={(event) => event.target.value && onCustom({ ...custom, to: event.target.value })}
                    />
                </span>
            )}
        </div>
    );
}
