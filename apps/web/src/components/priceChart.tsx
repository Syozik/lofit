import { HISTORY_RANGE_LABELS, HISTORY_RANGES, historyIn } from "@lofit/domain";
import type { Cents, HistoryRange, PricePoint } from "@lofit/domain";
import { useState } from "react";
import type { PointerEvent } from "react";

const WIDTH = 320;
const HEIGHT = 132;
const PAD = 0.08;

const dayFormat = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
});

const priceFormat = new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" });

function formatPrice(price: Cents): string {
    return priceFormat.format(price / 100);
}

function formatChange(from: Cents, to: Cents): string {
    const amount = to - from;
    const sign = amount < 0 ? "−" : "+";
    const pct = from === 0 ? 0 : (Math.abs(amount) / from) * 100;
    return `${sign}${priceFormat.format(Math.abs(amount) / 100)} · ${sign}${pct.toFixed(1)}%`;
}

function scale(points: readonly PricePoint[], cost: Cents | undefined) {
    const prices = points.map((point) => point.price as number);
    if (cost !== undefined) prices.push(cost);

    const lo = Math.min(...prices);
    const hi = Math.max(...prices);
    const span = hi - lo || hi || 1;
    const bottom = lo - span * PAD;
    const top = hi + span * PAD;

    return {
        x: (index: number) => (points.length < 2 ? WIDTH : (index / (points.length - 1)) * WIDTH),
        y: (price: number) => HEIGHT - ((price - bottom) / (top - bottom)) * HEIGHT,
    };
}

type Props = {
    points: readonly PricePoint[];
    cost: Cents | undefined;
    heldSince: string;
};

export function PriceChart({ points: history, cost, heldSince }: Props) {
    const [range, setRange] = useState<HistoryRange>("1y");
    const [hover, setHover] = useState<number | null>(null);

    const ranges = HISTORY_RANGES.filter((option) => historyIn(history, option, heldSince).length > 1);
    const active = ranges.includes(range) ? range : "1y";
    const points = historyIn(history, active, heldSince);
    const first = points[0];
    const last = points[points.length - 1];
    if (!first || !last) return null;

    const { x, y } = scale(points, cost);
    const line = points.map((point, index) => `${index === 0 ? "M" : "L"}${x(index)},${y(point.price)}`).join("");
    const area = `${line}L${WIDTH},${HEIGHT}L0,${HEIGHT}Z`;

    const boughtAt = points.findIndex((point) => point.day >= heldSince);
    const showBought = boughtAt > 0;

    const focus = hover === null ? undefined : points[hover];
    const shown = focus ?? last;
    const rising = shown.price >= first.price;

    function track(event: PointerEvent<HTMLDivElement>) {
        const box = event.currentTarget.getBoundingClientRect();
        const fraction = Math.min(Math.max((event.clientX - box.left) / box.width, 0), 1);
        setHover(Math.round(fraction * (points.length - 1)));
    }

    return (
        <div className="price-chart">
            <div className="price-readout">
                <span className="price-value">{formatPrice(shown.price)}</span>
                <span className={`price-change ${rising ? "up" : ""}`}>{formatChange(first.price, shown.price)}</span>
                <span className="price-day">{focus ? dayFormat.format(new Date(focus.day)) : "Last close"}</span>
            </div>

            <div
                className="price-plot"
                onPointerMove={track}
                onPointerDown={track}
                onPointerLeave={() => setHover(null)}
                onPointerCancel={() => setHover(null)}
            >
                <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" aria-hidden>
                    <path className="price-area" d={area} />
                    {cost !== undefined && (
                        <line className="price-cost" x1={0} x2={WIDTH} y1={y(cost)} y2={y(cost)} />
                    )}
                    {showBought && (
                        <line className="price-bought" x1={x(boughtAt)} x2={x(boughtAt)} y1={0} y2={HEIGHT} />
                    )}
                    <path className="price-line" d={line} />
                    {focus && hover !== null && (
                        <line className="price-cross" x1={x(hover)} x2={x(hover)} y1={0} y2={HEIGHT} />
                    )}
                </svg>

                {focus && hover !== null && (
                    <span
                        className="price-dot"
                        style={{ left: `${(x(hover) / WIDTH) * 100}%`, top: `${(y(focus.price) / HEIGHT) * 100}%` }}
                    />
                )}
                {cost !== undefined && (
                    <span className="price-cost-label" style={{ top: `${(y(cost) / HEIGHT) * 100}%` }}>
                        Your cost {formatPrice(cost)}
                    </span>
                )}
            </div>

            <div className="price-axis">
                <span>{dayFormat.format(new Date(first.day))}</span>
                <span>{dayFormat.format(new Date(last.day))}</span>
            </div>

            <div className="ranges">
                {ranges.map((option) => (
                    <button
                        key={option}
                        className={`tag range-chip ${active === option ? "selected" : ""}`}
                        onClick={() => {
                            setRange(option);
                            setHover(null);
                        }}
                    >
                        {HISTORY_RANGE_LABELS[option]}
                    </button>
                ))}
            </div>
        </div>
    );
}
