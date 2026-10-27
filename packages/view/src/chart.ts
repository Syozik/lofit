import { numberFormat } from "./intl";

const PAD = 0.08;
const DAY_MS = 86_400_000;
const Y_TICKS = 4;
const X_TICKS = 4;

export type LinePoint = {
    t: number;
    value: number;
};

export type LineScale = {
    bottom: number;
    top: number;
    duration: number;
    x: (t: number) => number;
    y: (value: number) => number;
    at: (fraction: number) => number;
};

export function lineScale(
    points: readonly LinePoint[],
    extra: readonly number[],
    width: number,
    height: number,
): LineScale {
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
        x: (t) => (duration <= 0 ? width : ((t - start) / duration) * width),
        y: (value) => height - ((value - bottom) / (top - bottom)) * height,
        at: (fraction) => start + fraction * duration,
    };
}

export function linePath(points: readonly LinePoint[], scale: Pick<LineScale, "x" | "y">): string {
    return points.map((point, index) => `${index === 0 ? "M" : "L"}${scale.x(point.t)},${scale.y(point.value)}`).join("");
}

function niceStep(span: number, count: number): number {
    const raw = span / count;
    const power = 10 ** Math.floor(Math.log10(raw));
    const step = [1, 2, 2.5, 5, 10].find((factor) => factor * power >= raw) ?? 10;
    return step * power;
}

export function valueTicks(bottom: number, top: number): { ticks: number[]; step: number } {
    const step = niceStep(top - bottom || 1, Y_TICKS);
    const ticks: number[] = [];
    for (let tick = Math.ceil(bottom / step) * step; tick <= top; tick += step) ticks.push(tick);
    return { ticks, step };
}

function compactFormat(currency: string): (units: number) => string {
    try {
        const format = numberFormat("en-IE", {
            style: "currency",
            currency,
            notation: "compact",
            maximumFractionDigits: 1,
        });
        if (format.format(25_000).includes("K")) return (units) => format.format(units);
    } catch {
        return manualCompact(currency);
    }
    return manualCompact(currency);
}

function manualCompact(currency: string): (units: number) => string {
    const symbol = numberFormat("en-IE", { style: "currency", currency, maximumFractionDigits: 0 })
        .format(0)
        .replace(/[\d\s.,]/g, "");
    return (units) => {
        const abs = Math.abs(units);
        const [scaled, suffix] = abs >= 1e9 ? [abs / 1e9, "B"] : abs >= 1e6 ? [abs / 1e6, "M"] : [abs / 1e3, "K"];
        const rounded = Math.round(scaled * 10) / 10;
        return `${units < 0 ? "−" : ""}${symbol}${rounded}${suffix}`;
    };
}

export function tickFormat(currency: string, step: number): (value: number) => string {
    const units = step / 100;
    if (units >= 1000) {
        const compact = compactFormat(currency);
        return (value) => compact(value / 100);
    }
    const digits = Math.min(2, Math.max(0, -Math.floor(Math.log10(units))));
    const format = numberFormat("en-IE", {
        style: "currency",
        currency,
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    });
    return (value) => format.format(value / 100);
}

export function timeFormats(duration: number) {
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

export function timeTicks(scale: Pick<LineScale, "at" | "duration">): { t: number; label: string; fraction: number }[] {
    const format = timeFormats(scale.duration).axis;
    const ticks = Array.from({ length: X_TICKS }, (_, index) => {
        const fraction = index / (X_TICKS - 1);
        const t = scale.at(fraction);
        return { t, fraction, label: format(t) };
    });
    return ticks.map((tick, index) =>
        index > 0 && tick.label === ticks[index - 1]!.label ? { ...tick, label: "" } : tick,
    );
}

export function nearest(points: readonly LinePoint[], t: number): number {
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

export function formatChange(format: (amount: number) => string, from: number, to: number): string {
    const amount = to - from;
    const sign = amount < 0 ? "−" : "+";
    const pct = from === 0 ? 0 : (Math.abs(amount) / Math.abs(from)) * 100;
    return `${sign}${format(Math.abs(amount))} · ${sign}${pct.toFixed(1)}%`;
}
