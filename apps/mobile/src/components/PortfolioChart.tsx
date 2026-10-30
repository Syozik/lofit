import { allocation, formatMoney, gainsBySymbol, portfolioGain } from "@lofit/domain";
import type { Holding, HoldingGain } from "@lofit/domain";
import { rankColor, signedPercent, signedWholeMoney } from "@lofit/view";
import { ChevronRight } from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Colors } from "../theme";
import { fonts, radius, space, useStyles, useTheme } from "../theme";
import { Segmented } from "./Choices";

type Mode = "allocation" | "gains";

const MODES = [
    { value: "allocation", label: "Allocation" },
    { value: "gains", label: "Gains" },
] as const;

function Allocation({ holdings }: { holdings: readonly Holding[] }) {
    const { tokenColor } = useTheme();
    const styles = useStyles(makeStyles);
    const shares = allocation(holdings);

    return (
        <>
            <View style={styles.strip}>
                {shares.map((share, rank) => (
                    <View
                        key={share.key}
                        style={{
                            flex: share.pct,
                            backgroundColor: tokenColor(rankColor(rank, share.key === "other")),
                        }}
                    />
                ))}
            </View>
            <View style={styles.parts}>
                {shares.map((share, rank) => (
                    <View key={share.key} style={styles.part}>
                        <View
                            style={[
                                styles.dot,
                                {
                                    backgroundColor: tokenColor(
                                        rankColor(rank, share.key === "other"),
                                    ),
                                },
                            ]}
                        />
                        <Text style={styles.partName} numberOfLines={1}>
                            {share.label}
                        </Text>
                        <Text style={styles.partValue}>{formatMoney(share.value)}</Text>
                        <Text style={styles.partShare}>{Math.round(share.pct)}%</Text>
                    </View>
                ))}
            </View>
        </>
    );
}

function GainBar({
    row,
    reach,
    diverging,
}: {
    row: HoldingGain;
    reach: number;
    diverging: boolean;
}) {
    const styles = useStyles(makeStyles);
    const length = reach === 0 ? 0 : (Math.abs(row.gain.pct) / reach) * (diverging ? 50 : 100);
    const start = !diverging ? 0 : row.gain.pct < 0 ? 50 - length : 50;
    const up = row.gain.favourable;

    return (
        <View style={styles.gainRow}>
            <Text style={styles.gainName} numberOfLines={1}>
                {row.label}
            </Text>
            <View style={styles.track}>
                {diverging && <View style={styles.axis} />}
                <View
                    style={[
                        styles.fill,
                        up && styles.fillUp,
                        { left: `${start}%`, width: `${Math.max(length, 0.6)}%` },
                    ]}
                />
            </View>
            <Text style={[styles.gainPct, up && styles.up]}>{signedPercent(row.gain.pct)}</Text>
            <Text style={styles.gainAmount}>{signedWholeMoney(row.gain.amount)}</Text>
        </View>
    );
}

function Gains({ holdings }: { holdings: readonly Holding[] }) {
    const styles = useStyles(makeStyles);
    const rows = gainsBySymbol(holdings);
    if (rows.length === 0) return <Text style={styles.empty}>Add what you paid to see gains</Text>;

    const reach = Math.max(...rows.map((row) => Math.abs(row.gain.pct)));
    const diverging = rows.some((row) => row.gain.pct < 0);

    return (
        <View style={styles.parts}>
            {rows.map((row) => (
                <GainBar key={row.key} row={row} reach={reach} diverging={diverging} />
            ))}
        </View>
    );
}

export function PortfolioChart({ holdings }: { holdings: readonly Holding[] }) {
    const { colors } = useTheme();
    const styles = useStyles(makeStyles);
    const [open, setOpen] = useState(false);
    const [mode, setMode] = useState<Mode>("allocation");
    const gain = portfolioGain(holdings);

    return (
        <View style={styles.card}>
            <Pressable
                style={styles.row}
                onPress={() => setOpen(!open)}
                accessibilityState={{ expanded: open }}
            >
                <Text style={styles.name}>Portfolio</Text>
                {gain && (
                    <Text style={[styles.gain, gain.favourable && styles.up]}>
                        {signedWholeMoney(gain.amount)} · {signedPercent(gain.pct)}
                    </Text>
                )}
                <ChevronRight
                    size={16}
                    color={colors.subtle}
                    style={[styles.caret, open && { transform: [{ rotate: "90deg" }] }]}
                />
            </Pressable>

            {open && (
                <View style={styles.body}>
                    <Segmented options={MODES} value={mode} onChange={setMode} />
                    {mode === "allocation" ? (
                        <Allocation holdings={holdings} />
                    ) : (
                        <Gains holdings={holdings} />
                    )}
                </View>
            )}
        </View>
    );
}

const makeStyles = (colors: Colors) =>
    StyleSheet.create({
        card: {
            borderRadius: radius.md,
            backgroundColor: colors.surface,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.divider,
        },
        row: {
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            paddingVertical: 13,
            paddingHorizontal: 14,
        },
        name: { fontFamily: fonts.regular, fontSize: 14, color: colors.text },
        gain: {
            fontFamily: fonts.regular,
            fontSize: 11,
            color: colors.muted,
            fontVariant: ["tabular-nums"],
        },
        up: { color: colors.accentStrong },
        caret: { marginLeft: "auto" },
        body: { gap: space[4], paddingHorizontal: 14, paddingBottom: 14 },
        strip: { flexDirection: "row", gap: 2, height: 8, borderRadius: 4, overflow: "hidden" },
        parts: { gap: space[3] },
        part: { flexDirection: "row", alignItems: "center", gap: 10 },
        dot: { width: 6, height: 6, borderRadius: 3 },
        partName: { flex: 1, fontFamily: fonts.regular, fontSize: 12.5, color: colors.quiet },
        partValue: {
            fontFamily: fonts.regular,
            fontSize: 12.5,
            color: colors.text,
            fontVariant: ["tabular-nums"],
        },
        partShare: {
            width: 34,
            textAlign: "right",
            fontFamily: fonts.regular,
            fontSize: 11,
            color: colors.muted,
        },
        gainRow: { flexDirection: "row", alignItems: "center", gap: 10 },
        gainName: { width: 52, fontFamily: fonts.regular, fontSize: 12, color: colors.quiet },
        track: { flex: 1, height: 10 },
        axis: {
            position: "absolute",
            left: "50%",
            top: -2,
            bottom: -2,
            width: 1,
            backgroundColor: colors.divider,
        },
        fill: {
            position: "absolute",
            top: 0,
            bottom: 0,
            borderRadius: 4,
            backgroundColor: colors.subtle,
        },
        fillUp: { backgroundColor: colors.gain },
        gainPct: {
            width: 52,
            textAlign: "right",
            fontFamily: fonts.regular,
            fontSize: 12,
            color: colors.muted,
            fontVariant: ["tabular-nums"],
        },
        gainAmount: {
            width: 64,
            textAlign: "right",
            fontFamily: fonts.regular,
            fontSize: 12,
            color: colors.text,
            fontVariant: ["tabular-nums"],
        },
        empty: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
    });
