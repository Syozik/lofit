import { cents, defaultCustom, historyIn, PRICE_RANGES } from "@lofit/domain";
import type { Cents, DayWindow, HistoryRange, PricePoint } from "@lofit/domain";
import { currencyFormat, dayFormat, formatChange } from "@lofit/view";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, fonts, space } from "../theme";
import { LineChart } from "./LineChart";
import { RangePicker } from "./RangePicker";

type Props = {
    points: readonly PricePoint[];
    currency: string;
    cost: Cents | undefined;
    heldSince: string;
};

export function PriceChart({ points: history, currency, cost, heldSince }: Props) {
    const priceFormat = currencyFormat(currency);
    const formatPrice = (price: number) => priceFormat.format(price / 100);

    const bounds = {
        from: history[0]?.day ?? heldSince,
        to: history[history.length - 1]?.day ?? heldSince,
    };
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
        <View style={styles.chart}>
            {first && last && shown && (
                <>
                    <View style={styles.readout}>
                        <Text style={styles.value}>{formatPrice(shown.price)}</Text>
                        <Text style={[styles.change, shown.price >= first.price && styles.up]}>
                            {formatChange(
                                (amount) => formatPrice(cents(amount)),
                                first.price,
                                shown.price,
                            )}
                        </Text>
                        <Text style={styles.day}>
                            {focus ? dayFormat.format(new Date(focus.day)) : "Last close"}
                        </Text>
                    </View>

                    <LineChart
                        points={points.map((point) => ({
                            t: Date.parse(point.day),
                            value: point.price,
                        }))}
                        hover={hover}
                        onHover={setHover}
                        currency={currency}
                        {...(cost !== undefined
                            ? { level: { value: cost, label: `Your cost ${formatPrice(cost)}` } }
                            : {})}
                        {...(boughtAt > 0 ? { marker: Date.parse(heldSince) } : {})}
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
        </View>
    );
}

const styles = StyleSheet.create({
    chart: { gap: space[3] },
    readout: { flexDirection: "row", alignItems: "baseline", gap: 10 },
    value: {
        fontFamily: fonts.medium,
        fontSize: 20,
        color: colors.text,
        fontVariant: ["tabular-nums"],
    },
    change: {
        fontFamily: fonts.regular,
        fontSize: 12,
        color: colors.muted,
        fontVariant: ["tabular-nums"],
    },
    up: { color: colors.accentStrong },
    day: { marginLeft: "auto", fontFamily: fonts.regular, fontSize: 11, color: colors.muted },
});
