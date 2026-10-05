import { useId } from "react";
import type { PointerEvent } from "react";

const WIDTH = 320;
const HEIGHT = 132;
const PAD = 0.08;
const DAY_MS = 86_400_000;
const Y_TICKS = 4;
const X_TICKS = 4;

export type LinePoint = {
    t: number;
    value: number;
};

function scale(points: readonly LinePoint[], extra: readonly number[]) {
    const values = [...points.map((point) => point.value), ...extra];
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    const span = hi - lo || Math.abs(hi) || 1;
    const bottom = lo - span * PAD;
    const top = hi + span * PAD;

    const start = points[0]?.t ?? 0;
    const end = points[points.length - 1]?.t ?? 0;
    const duration = end - start;

    return {
        bottom,
        top,
        duration,
        x: (t: number) => (duration <= 0 ? WIDTH : ((t - start) / duration) * WIDTH),
        y: (value: number) => HEIGHT - ((value - bottom) / (top - bottom)) * HEIGHT,
        at: (fraction: number) => start + fraction * duration,
    };
}

function path(points: readonly LinePoint[], x: (t: number) => number, y: (value: number) => number): string {
    return points.map((point, index) => `${index === 0 ? "M" : "L"}${x(point.t)},${y(point.value)}`).join("");
}

function niceStep(span: number, count: number): number {
    const raw = span / count;
    const power = 10 ** Math.floor(Math.log10(raw));
    const step = [1, 2, 2.5, 5, 10].find((factor) => factor * power >= raw) ?? 10;
    return step * power;
}

function valueTicks(bottom: number, top: number): { ticks: number[]; step: number } {
    const step = niceStep(top - bottom || 1, Y_TICKS);
    const ticks: number[] = [];
    for (let tick = Math.ceil(bottom / step) * step; tick <= top; tick += step) ticks.push(tick);
    return { ticks, step };
}

function tickFormat(currency: string, step: number): (value: number) => string {
    const units = step / 100;
    const compact = units >= 1000;
    const digits = compact ? 1 : Math.min(2, Math.max(0, -Math.floor(Math.log10(units))));
    const format = new Intl.NumberFormat("en-IE", {
        style: "currency",
        currency,
        notation: compact ? "compact" : "standard",
        minimumFractionDigits: compact ? 0 : digits,
        maximumFractionDigits: digits,
    });
    return (value) => format.format(value / 100);
}

function timeFormats(duration: number) {
    const intraday = duration <= 2 * DAY_MS;
    const axis = new Intl.DateTimeFormat(
        "en-GB",
        intraday
            ? { hour: "2-digit", minute: "2-digit" }
            : duration <= 75 * DAY_MS
              ? { day: "numeric", month: "short", timeZone: "UTC" }
              : duration <= 2 * 365 * DAY_MS
                ? { month: "short", year: "2-digit", timeZone: "UTC" }
                : { year: "numeric", timeZone: "UTC" },
    );
    const full = new Intl.DateTimeFormat(
        "en-GB",
        intraday
            ? { weekday: "short", hour: "2-digit", minute: "2-digit" }
            : { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" },
    );
    return { axis: (t: number) => axis.format(new Date(t)), full: (t: number) => full.format(new Date(t)) };
}

function nearest(points: readonly LinePoint[], t: number): number {
    let low = 0;
    let high = points.length - 1;
    while (low < high) {
        const mid = (low + high) >> 1;
        if ((points[mid] as LinePoint).t < t) low = mid + 1;
        else high = mid;
    }
    const before = points[low - 1];
    return before && t - before.t < (points[low] as LinePoint).t - t ? low - 1 : low;
}

type Props = {
    points: readonly LinePoint[];
    hover: number | null;
    onHover: (index: number | null) => void;
    guide?: readonly LinePoint[];
    level?: { value: number; label: string };
    marker?: number;
    currency?: string;
};

export function LineChart({ points, hover, onHover, guide, level, marker, currency = "EUR" }: Props) {
    const clipId = useId();
    const { x, y, at, bottom, top, duration } = scale(points, level ? [level.value] : []);
    const line = path(points, x, y);
    const area = `${line}L${WIDTH},${HEIGHT}L0,${HEIGHT}Z`;
    const focus = hover === null ? undefined : points[hover];

    const { ticks, step } = valueTicks(bottom, top);
    const formatTick = tickFormat(currency, step);
    const valueFormat = new Intl.NumberFormat("en-IE", { style: "currency", currency });
    const time = timeFormats(duration);
    const times = Array.from({ length: X_TICKS }, (_, index) => at(index / (X_TICKS - 1)));
    const timeLabels = times.map((t, index) => {
        const label = time.axis(t);
        return index > 0 && label === time.axis(times[index - 1] as number) ? "" : label;
    });
    const focusX = focus ? (x(focus.t) / WIDTH) * 100 : 0;

    function track(event: PointerEvent<HTMLDivElement>) {
        const box = event.currentTarget.getBoundingClientRect();
        const fraction = Math.min(Math.max((event.clientX - box.left) / box.width, 0), 1);
        onHover(nearest(points, at(fraction)));
    }

    return (
        <>
            <div
                className="price-plot"
                onPointerMove={track}
                onPointerDown={track}
                onPointerLeave={() => onHover(null)}
                onPointerCancel={() => onHover(null)}
            >
                <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" aria-hidden>
                    <clipPath id={clipId}>
                        <rect x={0} y={0} width={WIDTH} height={HEIGHT} />
                    </clipPath>
                    <path className="price-area" d={area} />
                    {level && <line className="price-cost" x1={0} x2={WIDTH} y1={y(level.value)} y2={y(level.value)} />}
                    {guide && guide.length > 1 && <path className="price-guide" d={path(guide, x, y)} clipPath={`url(#${clipId})`} />}
                    {marker !== undefined && (
                        <line className="price-bought" x1={x(marker)} x2={x(marker)} y1={0} y2={HEIGHT} />
                    )}
                    <path className="price-line" d={line} />
                    {focus && <line className="price-cross" x1={x(focus.t)} x2={x(focus.t)} y1={0} y2={HEIGHT} />}
                </svg>

                {ticks.map((tick) => (
                    <span key={tick} className="price-tick" style={{ top: `${(y(tick) / HEIGHT) * 100}%` }}>
                        {formatTick(tick)}
                    </span>
                ))}
                {focus && (
                    <span
                        className={`price-tip ${focusX < 20 ? "start" : focusX > 80 ? "end" : ""}`}
                        style={{ left: `${focusX}%` }}
                    >
                        <strong>{valueFormat.format(focus.value / 100)}</strong>
                        <span>{time.full(focus.t)}</span>
                    </span>
                )}
                {focus && (
                    <span
                        className="price-dot"
                        style={{ left: `${(x(focus.t) / WIDTH) * 100}%`, top: `${(y(focus.value) / HEIGHT) * 100}%` }}
                    />
                )}
                {level && (
                    <span className="price-cost-label" style={{ top: `${(y(level.value) / HEIGHT) * 100}%` }}>
                        {level.label}
                    </span>
                )}
            </div>

            <div className="price-axis">
                {times.map((t, index) => (
                    <span key={t} style={{ left: `${(index / (X_TICKS - 1)) * 100}%` }}>
                        {timeLabels[index]}
                    </span>
                ))}
            </div>
        </>
    );
}
