import { formatMoney } from "@lofit/domain";
import type { Cents } from "@lofit/domain";
import type { NetWorthTrendState } from "@lofit/api";
import { LineChart } from "./lineChart";
import { RangePicker } from "./rangePicker";

export type TrendPart = {
    id: string;
    label: string;
    value: Cents;
    color: string;
};

export function NetWorthRanges({ trend }: { trend: NetWorthTrendState }) {
    return (
        <RangePicker
            ranges={trend.ranges}
            active={trend.range}
            onSelect={trend.selectRange}
            custom={trend.custom}
            onCustom={trend.setCustom}
            bounds={trend.bounds}
        />
    );
}

type Props = {
    trend: NetWorthTrendState;
    parts?: readonly TrendPart[];
    ranges?: boolean;
};

export function NetWorthTrend({ trend, parts, ranges = true }: Props) {
    const values = trend.points.map((point) => point.value);
    const low = Math.min(...values);
    const high = Math.max(...values);
    const slack = (high - low) * 0.08;
    const showInvested = trend.points.some(
        (point) =>
            point.invested !== undefined &&
            point.invested > 0 &&
            point.invested >= low - slack &&
            point.invested <= high + slack,
    );

    return (
        <div className="price-chart">
            {trend.points.length > 1 ? (
                <LineChart
                    points={trend.points.map((point) => ({ t: Date.parse(point.at), value: point.value }))}
                    hover={trend.hover}
                    onHover={trend.setHover}
                    grid
                    {...(showInvested
                        ? { guide: trend.points.map((point) => ({ t: Date.parse(point.at), value: point.invested ?? 0 })) }
                        : {})}
                />
            ) : (
                <div className="price-chart price-pending">
                    {trend.pending ? "Loading prices…" : trend.failed ? "Could not load prices" : "Not enough history yet"}
                </div>
            )}

            {showInvested && (
                <div className="trend-legend">
                    <span className="trend-key value">Value</span>
                    <span className="trend-key invested">Invested</span>
                </div>
            )}

            {parts && parts.length > 0 && (
                <div className="trend-parts nw-parts">
                    {parts.map((part) => (
                        <div key={part.id} className="trend-part">
                            <span className="trend-dot" style={{ background: part.color }} />
                            <span className="trend-name">{part.label}</span>
                            <span className={`trend-value ${part.value < 0 ? "negative" : ""}`}>
                                {formatMoney(part.value)}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {ranges && <NetWorthRanges trend={trend} />}
        </div>
    );
}
