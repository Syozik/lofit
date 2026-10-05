import { formatEuros } from "@lofit/domain";
import type { Cents } from "@lofit/domain";

const SEGMENT_GAP_DEG = 1.6;

const DIMMED_COLOR = "var(--color-neutral-900)";

export type Slice = {
    key: string;
    label: string;
    value: Cents;
    color: string;
};

function wholeShares(weights: readonly number[]): number[] {
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    if (total === 0) return weights.map(() => 0);

    const exact = weights.map((weight) => (weight / total) * 100);
    const shares = exact.map((value) => Math.floor(value));
    const byRemainder = exact
        .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
        .sort((a, b) => b.remainder - a.remainder);

    let left = 100 - shares.reduce((sum, share) => sum + share, 0);
    for (const { index } of byRemainder) {
        if (left <= 0) break;
        shares[index]! += 1;
        left -= 1;
    }

    return shares;
}

type Segment = Slice & {
    share: number;
    from: number;
    to: number;
    end: number;
};

function toSegments(slices: readonly Slice[]): Segment[] {
    const weights = slices.map((slice) => Math.abs(slice.value));
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    if (total === 0) return [];

    const shares = wholeShares(weights);
    const segments: Segment[] = [];
    let sweptDeg = 0;

    for (const [index, slice] of slices.entries()) {
        const sweep = (weights[index]! / total) * 360;
        const from = sweptDeg;
        sweptDeg += sweep;
        const gap = slices.length > 1 ? Math.min(SEGMENT_GAP_DEG, sweep / 3) : 0;

        segments.push({
            ...slice,
            share: shares[index]!,
            from,
            to: sweptDeg - gap,
            end: sweptDeg,
        });
    }

    return segments;
}

function ringGradient(segments: readonly Segment[], focused: string | null): string {
    const stops = segments.map(({ key, color, from, to, end }) => {
        const paint = !focused || key === focused ? color : DIMMED_COLOR;
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
                            <span className="legend-dot" style={{ background: segment.color }} />
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
