import type { NetWorthTrendState } from "@lofit/api";
import { formatEuros } from "@lofit/domain";
import type { Cents } from "@lofit/domain";
import { StyleSheet, Text, View } from "react-native";
import { colors, fonts, space } from "../theme";
import { LineChart } from "./LineChart";
import { RangePicker } from "./RangePicker";

export type TrendPart = {
    id: string;
    label: string;
    value: Cents;
    color: string;
};

type Props = {
    trend: NetWorthTrendState;
    parts: readonly TrendPart[];
};

export function NetWorthTrend({ trend, parts }: Props) {
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
        <View style={styles.chart}>
            {trend.points.length > 1 ? (
                <LineChart
                    points={trend.points.map((point) => ({
                        t: Date.parse(point.at),
                        value: point.value,
                    }))}
                    hover={trend.hover}
                    onHover={trend.setHover}
                    {...(showInvested
                        ? {
                              guide: trend.points.map((point) => ({
                                  t: Date.parse(point.at),
                                  value: point.invested ?? 0,
                              })),
                          }
                        : {})}
                />
            ) : (
                <View style={styles.pending}>
                    <Text style={styles.pendingText}>
                        {trend.pending
                            ? "Loading prices…"
                            : trend.failed
                              ? "Could not load prices"
                              : "Not enough history yet"}
                    </Text>
                </View>
            )}

            {showInvested && (
                <View style={styles.legend}>
                    <View style={styles.key}>
                        <View style={styles.keyValue} />
                        <Text style={styles.keyText}>Value</Text>
                    </View>
                    <View style={styles.key}>
                        <View style={styles.keyInvested} />
                        <Text style={styles.keyText}>Invested</Text>
                    </View>
                </View>
            )}

            {parts.length > 0 && (
                <View style={styles.parts}>
                    {parts.map((part) => (
                        <View key={part.id} style={styles.part}>
                            <View style={[styles.dot, { backgroundColor: part.color }]} />
                            <Text style={styles.partName} numberOfLines={1}>
                                {part.label}
                            </Text>
                            <Text style={[styles.partValue, part.value < 0 && styles.negative]}>
                                {formatEuros(part.value)}
                            </Text>
                        </View>
                    ))}
                </View>
            )}

            <RangePicker
                ranges={trend.ranges}
                active={trend.range}
                onSelect={trend.selectRange}
                custom={trend.custom}
                onCustom={trend.setCustom}
                bounds={trend.bounds}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    chart: { gap: space[3] },
    pending: { height: 152, alignItems: "center", justifyContent: "center" },
    pendingText: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
    legend: { flexDirection: "row", gap: 14 },
    key: { flexDirection: "row", alignItems: "center", gap: 6 },
    keyValue: { width: 12, height: 2, borderRadius: 1, backgroundColor: colors.accent },
    keyInvested: {
        width: 12,
        height: 0,
        borderTopWidth: 1.5,
        borderStyle: "dashed",
        borderColor: colors.subtle,
    },
    keyText: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted },
    parts: { gap: space[2] },
    part: { flexDirection: "row", alignItems: "center", gap: 10 },
    dot: { width: 6, height: 6, borderRadius: 3 },
    partName: { flex: 1, fontFamily: fonts.regular, fontSize: 12.5, color: colors.quiet },
    partValue: {
        fontFamily: fonts.regular,
        fontSize: 12.5,
        color: colors.text,
        fontVariant: ["tabular-nums"],
    },
    negative: { color: colors.muted },
});
