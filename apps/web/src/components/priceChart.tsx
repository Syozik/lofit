import { cents, historyIn, PRICE_RANGES } from "@lofit/domain";
import { currencyFormat, defaultCustom, formatChange } from "@lofit/view";
import type { Cents, DayWindow, HistoryRange, PricePoint } from "@lofit/domain";
import { useState } from "react";
import { LineChart } from "./lineChart";
import { RangePicker } from "./rangePicker";

const dayFormat = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
});

type Props = {
    points: readonly PricePoint[];
    currency: string;
    cost: Cents | undefined;
    heldSince: string;
};

export function PriceChart({ points: history, currency, cost, heldSince }: Props) {
    const priceFormat = currencyFormat(currency);
    const formatPrice = (price: Cents) => priceFormat.format(price / 100);

    const bounds = { from: history[0]?.day ?? heldSince, to: history[history.length - 1]?.day ?? heldSince };
    const [range, setRange] = useState<HistoryRange>("1y");
    const [custom, setCustom] = useState<DayWindow>(() => defaultCustom(bounds.from, bounds.to));
    const [hover, setHover] = useState<number | null>(null);

    const ranges = PRICE_RANGES.filter(
        (option) => option === "custom" || historyIn(history, option, heldSince).length > 1,
    );
    const active = ranges.includes(range) ? range : "1y";
    const points = historyIn(history, active, heldSince, custom);
    const first = points[0];
    const last = points[points.length - 1];

    const boughtAt = points.findIndex((point) => point.day >= heldSince);
    const focus = hover === null ? undefined : points[hover];
    const shown = focus ?? last;

    return (
        <div className="price-chart">
            {first && last && shown && (
                <>
                    <div className="price-readout">
                        <span className="price-value">{formatPrice(shown.price)}</span>
                        <span className={`price-change ${shown.price >= first.price ? "up" : ""}`}>
                            {formatChange((amount) => formatPrice(cents(amount)), first.price, shown.price)}
                        </span>
                        <span className="price-day">{focus ? dayFormat.format(new Date(focus.day)) : "Last close"}</span>
                    </div>

                    <LineChart
                        points={points.map((point) => ({ t: Date.parse(point.day), value: point.price }))}
                        hover={hover}
                        onHover={setHover}
                        {...(cost !== undefined ? { level: { value: cost, label: `Your cost ${formatPrice(cost)}` } } : {})}
                        {...(boughtAt > 0 ? { marker: Date.parse(heldSince) } : {})}
                        currency={currency}
                    />
                </>
            )}

            <RangePicker
                ranges={ranges}
                active={active}
                onSelect={(option) => {
                    setRange(option);
                    setHover(null);
                }}
                custom={custom}
                onCustom={(window) => {
                    setCustom(window);
                    setHover(null);
                }}
                bounds={bounds}
            />
        </div>
    );
}
