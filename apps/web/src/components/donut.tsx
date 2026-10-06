import { formatEuros } from "@lofit/domain";
import { DIMMED_COLOR, toSegments } from "@lofit/view";
import type { Segment, Slice } from "@lofit/view";
import { cssColor } from "../helpers/palette";


function ringGradient(segments: readonly Segment[], focused: string | null): string {
    const stops = segments.map(({ key, color, from, to, end }) => {
        const paint = cssColor(!focused || key === focused ? color : DIMMED_COLOR);
        return (
            `${paint} ${from.toFixed(2)}deg ${to.toFixed(2)}deg, ` +
            `transparent ${to.toFixed(2)}deg ${end.toFixed(2)}deg`
        );
    });

    return `conic-gradient(from -90deg, ${stops.join(", ")})`;
}

type Props = {
    slices: readonly Slice[];
    focused: string | null;
    onFocus: (key: string | null) => void;
    label: string;
    value: string;
    scoped?: boolean;
};

export function Donut({ slices, focused, onFocus, label, value, scoped = false }: Props) {
    const segments = toSegments(slices);

    return (
        <div className="composition">
            <div className="donut">
                <div className="donut-ring" style={{ background: ringGradient(segments, focused) }} />
                <div className="donut-hole">
                    <span className="donut-label">{label}</span>
                    <span className="donut-value">{value}</span>
                </div>
            </div>

            <div className={`legend ${scoped ? "scoped" : ""}`}>
                {segments.map((segment) => (
                    <button
                        key={segment.key}
                        className={`legend-item ${focused && focused !== segment.key ? "dimmed" : ""}`}
                        aria-pressed={focused === segment.key}
                        onClick={() => onFocus(focused === segment.key ? null : segment.key)}
                    >
                        <span className="legend-head">
                            <span className="legend-dot" style={{ background: cssColor(segment.color) }} />
                            <span className="legend-name" title={segment.label}>
                                {segment.label}
                            </span>
                            <span className="legend-share">{segment.share}%</span>
                        </span>
                        <span className={`legend-value ${segment.value < 0 ? "negative" : ""}`}>
                            {formatEuros(segment.value)}
                        </span>
                    </button>
                ))}
            </div>
        </div>
    );
}
