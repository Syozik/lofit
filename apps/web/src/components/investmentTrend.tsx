import type { InvestmentTrendState } from "../useInvestmentTrend";
import { LineChart } from "./lineChart";
import { RangePicker } from "./rangePicker";

export function InvestmentRanges({ trend }: { trend: InvestmentTrendState }) {
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
    trend: InvestmentTrendState;
    ranges?: boolean;
};

export function InvestmentTrend({ trend, ranges = true }: Props) {
    const values = trend.points.map((point) => point.value);
    const low = Math.min(...values);
    const high = Math.max(...values);
    const slack = (high - low) * 0.08;
    const showInvested = trend.points.some(
        (point) => point.invested > 0 && point.invested >= low - slack && point.invested <= high + slack,
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
                        ? { guide: trend.points.map((point) => ({ t: Date.parse(point.at), value: point.invested })) }
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

            {ranges && <InvestmentRanges trend={trend} />}
        </div>
    );
}
