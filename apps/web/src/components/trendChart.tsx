import { amountIn, byPosition, formatEuros } from "@lofit/domain";
import type { Cents, Group, Snapshot } from "@lofit/domain";
import { groupColor } from "@lofit/view";
import { cssColor } from "../helpers/palette";
import { monthName, yearOf } from "../period";
import { useDesktop } from "../useDesktop";

const BAR_FLOOR = 26;
const BAR_RANGE = 58;
const BAR_FLOOR_SHARE = 24;
const BASELINE_SLACK = 0.972;

type Bar = {
    period: string;
    label: string;
    level: number;
};

function labelStride(count: number): number {
    if (count <= 12) return 1;
    if (count <= 24) return 2;
    return 3;
}

function toBars(snapshots: readonly Snapshot[], series: readonly Cents[]): Bar[] {
    const magnitudes = series.map((value) => Math.abs(value));
    const lo = Math.min(...magnitudes) * BASELINE_SLACK;
    const hi = Math.max(...magnitudes);
    const span = hi - lo || 1;

    const stride = labelStride(snapshots.length);
    const last = snapshots.length - 1;

    return snapshots.map((snapshot, index) => ({
        period: snapshot.period,
        label: (last - index) % stride === 0 ? monthName(snapshot.period, "short") : "",
        level: ((magnitudes[index] ?? 0) - lo) / span,
    }));
}

type Part = {
    label: string;
    value: Cents;
    color: string;
    pct: number;
};

function toParts(snapshot: Snapshot, groups: readonly Group[]): Part[] {
    const gross = snapshot.groups.reduce((sum, entry) => sum + Math.abs(entry.amount), 0);
    const share = (value: Cents) => (gross === 0 ? 0 : (Math.abs(value) / gross) * 100);

    return byPosition(groups)
        .map((group) => ({ group, amount: amountIn(snapshot, group.id) }))
        .filter((entry) => entry.amount !== 0)
        .map((entry) => ({
            label: entry.group.name,
            value: entry.amount,
            color: cssColor(groupColor(entry.group.position, entry.amount < 0)),
            pct: share(entry.amount),
        }));
}

type Props = {
    snapshots: readonly Snapshot[];
    groups: readonly Group[];
    series: readonly Cents[];
    selectedIndex: number;
    onSelect: (index: number) => void;
};

export function TrendChart({ snapshots, groups, series, selectedIndex, onSelect }: Props) {
    const desktop = useDesktop();
    const selected = snapshots[selectedIndex];
    if (!selected) return null;

    const bars = toBars(snapshots, series);
    const parts = toParts(selected, groups);

    return (
        <div className="trend">
            <div className={`trend-bars ${bars.length > 12 ? "dense" : ""}`}>
                {bars.map((bar, index) => (
                    <button
                        key={bar.period}
                        className={`trend-bar ${index === selectedIndex ? "active" : ""}`}
                        aria-pressed={index === selectedIndex}
                        onClick={() => onSelect(index)}
                    >
                        <span
                            className="trend-fill"
                            style={{
                                height: desktop
                                    ? `${BAR_FLOOR_SHARE + bar.level * (100 - BAR_FLOOR_SHARE)}%`
                                    : Math.round(BAR_FLOOR + bar.level * BAR_RANGE),
                            }}
                        />
                        {bar.label && <span className="trend-label">{bar.label}</span>}
                    </button>
                ))}
            </div>

            <div className="trend-strip">
                {parts.map((part) => (
                    <span
                        key={part.label}
                        style={{ width: `${part.pct.toFixed(1)}%`, background: part.color }}
                    />
                ))}
            </div>

            <div className="trend-parts">
                {desktop && (
                    <span className="trend-month">
                        {monthName(selected.period, "short")} {yearOf(selected.period)}
                    </span>
                )}
                {parts.map((part) => (
                    <div key={part.label} className="trend-part">
                        <span className="trend-dot" style={{ background: part.color }} />
                        <span className="trend-name">{part.label}</span>
                        <span className={`trend-value ${part.value < 0 ? "negative" : ""}`}>
                            {formatEuros(part.value)}
                        </span>
                        <span className="trend-share">{Math.round(part.pct)}%</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
