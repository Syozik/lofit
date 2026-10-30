import { displayCurrency } from "@lofit/domain";
import {
    currencyFormat,
    linePath,
    lineScale,
    nearest,
    tickFormat,
    timeFormats,
    timeTicks,
    valueTicks,
} from "@lofit/view";
import type { LinePoint } from "@lofit/view";
import { useId } from "react";
import type { PointerEvent } from "react";

const WIDTH = 320;
const HEIGHT = 132;

type Props = {
    points: readonly LinePoint[];
    hover: number | null;
    onHover: (index: number | null) => void;
    guide?: readonly LinePoint[];
    level?: { value: number; label: string };
    marker?: number;
    currency?: string;
    grid?: boolean;
};

export function LineChart({
    points,
    hover,
    onHover,
    guide,
    level,
    marker,
    currency = displayCurrency(),
    grid = false,
}: Props) {
    const clipId = useId();
    const scale = lineScale(points, level ? [level.value] : [], WIDTH, HEIGHT);
    const { x, y, at, bottom, top, duration } = scale;
    const line = linePath(points, scale);
    const area = `${line}L${WIDTH},${HEIGHT}L0,${HEIGHT}Z`;
    const focus = hover === null ? undefined : points[hover];

    const { ticks, step } = valueTicks(bottom, top);
    const formatTick = tickFormat(currency, step);
    const valueFormat = currencyFormat(currency);
    const time = timeFormats(duration);
    const times = timeTicks(scale);
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
                    {grid &&
                        ticks.map((tick) => (
                            <line
                                key={tick}
                                className="price-grid"
                                x1={0}
                                x2={WIDTH}
                                y1={y(tick)}
                                y2={y(tick)}
                            />
                        ))}
                    <path className="price-area" d={area} />
                    {level && (
                        <line
                            className="price-cost"
                            x1={0}
                            x2={WIDTH}
                            y1={y(level.value)}
                            y2={y(level.value)}
                        />
                    )}
                    {guide && guide.length > 1 && (
                        <path
                            className="price-guide"
                            d={linePath(guide, scale)}
                            clipPath={`url(#${clipId})`}
                        />
                    )}
                    {marker !== undefined && (
                        <line
                            className="price-bought"
                            x1={x(marker)}
                            x2={x(marker)}
                            y1={0}
                            y2={HEIGHT}
                        />
                    )}
                    <path className="price-line" d={line} />
                    {focus && (
                        <line
                            className="price-cross"
                            x1={x(focus.t)}
                            x2={x(focus.t)}
                            y1={0}
                            y2={HEIGHT}
                        />
                    )}
                </svg>

                {ticks.map((tick) => (
                    <span
                        key={tick}
                        className="price-tick"
                        style={{ top: `${(y(tick) / HEIGHT) * 100}%` }}
                    >
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
                        style={{
                            left: `${(x(focus.t) / WIDTH) * 100}%`,
                            top: `${(y(focus.value) / HEIGHT) * 100}%`,
                        }}
                    />
                )}
                {level && (
                    <span
                        className="price-cost-label"
                        style={{ top: `${(y(level.value) / HEIGHT) * 100}%` }}
                    >
                        {level.label}
                    </span>
                )}
            </div>

            <div className="price-axis">
                {times.map((tick) => (
                    <span key={tick.t} style={{ left: `${tick.fraction * 100}%` }}>
                        {tick.label}
                    </span>
                ))}
            </div>
        </>
    );
}
