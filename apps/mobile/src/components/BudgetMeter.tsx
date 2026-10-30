import { formatAmount, withSymbol } from "@lofit/domain";
import type { Cents } from "@lofit/domain";
import type { BudgetState, BudgetStatus } from "@lofit/view";
import { budgetStatus } from "@lofit/view";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Colors } from "../theme";
import { fonts, useStyles, useTheme } from "../theme";

function tone(colors: Colors, state: BudgetState): string {
    return state === "over" ? colors.danger : state === "ahead" ? colors.warning : colors.accent;
}

export function Meter({ status, thick = false }: { status: BudgetStatus; thick?: boolean }) {
    const { colors } = useTheme();
    const styles = useStyles(makeStyles);
    return (
        <View style={[styles.bar, thick && styles.thick]}>
            <View style={[styles.fill, { width: `${status.pct}%`, backgroundColor: tone(colors, status.state) }]} />
            {status.pace !== undefined && (
                <View style={[styles.pace, { left: `${Math.round(status.pace * 100)}%` }]} />
            )}
        </View>
    );
}

export function StatusNote({ status, style }: { status: BudgetStatus; style?: object }) {
    const { colors } = useTheme();
    const styles = useStyles(makeStyles);
    return (
        <Text style={[styles.note, style, status.state !== "ok" && { color: tone(colors, status.state) }]}>
            {status.note}
        </Text>
    );
}

type RowProps = {
    label: string;
    spent: Cents;
    limit: Cents;
    period: string;
    selected?: boolean;
    dimmed?: boolean;
    onPress?: () => void;
};

export function BudgetRow({ label, spent, limit, period, selected = false, dimmed = false, onPress }: RowProps) {
    const styles = useStyles(makeStyles);
    const status = budgetStatus(spent, limit, period);
    return (
        <Pressable
            disabled={!onPress}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={({ pressed }) => [styles.row, selected && styles.selected, dimmed && styles.dimmed, pressed && styles.pressed]}
        >
            <View style={styles.line}>
                <Text style={styles.name} numberOfLines={1}>
                    {label}
                </Text>
                <Text style={styles.spent}>
                    {withSymbol(formatAmount(spent))}
                </Text>
            </View>
            <Meter status={status} />
            <View style={styles.line}>
                <Text style={styles.limit}>
                    of {withSymbol(formatAmount(limit))}
                </Text>
                <StatusNote status={status} style={styles.right} />
            </View>
        </Pressable>
    );
}

const makeStyles = (colors: Colors) =>
    StyleSheet.create({
        bar: { height: 4, borderRadius: 2, backgroundColor: colors.hairline, justifyContent: "center" },
        thick: { height: 6, borderRadius: 3 },
        fill: { height: "100%", borderRadius: 3 },
        pace: {
            position: "absolute",
            top: -3,
            bottom: -3,
            width: 2,
            marginLeft: -1,
            borderRadius: 1,
            backgroundColor: colors.text,
            opacity: 0.55,
        },
        row: { gap: 7, paddingVertical: 8, paddingHorizontal: 8, marginHorizontal: -8, borderRadius: 8 },
        selected: { backgroundColor: colors.accentFill },
        dimmed: { opacity: 0.4 },
        pressed: { opacity: 0.6 },
        line: { flexDirection: "row", alignItems: "baseline", gap: 8 },
        name: { flex: 1, fontFamily: fonts.regular, fontSize: 14, color: colors.text },
        spent: { fontFamily: fonts.regular, fontSize: 14, color: colors.text, fontVariant: ["tabular-nums"] },
        limit: { flex: 1, fontFamily: fonts.regular, fontSize: 11, color: colors.muted, fontVariant: ["tabular-nums"] },
        note: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted, fontVariant: ["tabular-nums"] },
        right: { textAlign: "right" },
    });
