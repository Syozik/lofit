import { useAccounts, useGroups, useHoldings, useSnapshots } from "@lofit/api";
import {
    addCents,
    ALL_GROUPS,
    ALL_GROUPS_LABEL,
    cents,
    deltaAt,
    formatAmount,
    itemsInScope,
    netWorthGroups,
    netWorthItems,
    owesMoney,
    seriesFor,
} from "@lofit/domain";
import type { Delta, Scope } from "@lofit/domain";
import {
    centreLabel,
    kickerFor,
    monthName,
    netWorthSlices,
    shortEuros,
    signedAmount,
    signedPercent,
} from "@lofit/view";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Donut } from "../../components/Donut";
import { RecentTransactions } from "../../components/RecentTransactions";
import { Screen, Status, text } from "../../components/Screen";
import { colors, fonts, radius, space } from "../../theme";

function DeltaLine({ delta, previous }: { delta: Delta; previous: string }) {
    const tone = delta.favourable ? styles.up : null;
    return (
        <View style={styles.delta}>
            <Text style={[styles.deltaAmount, tone]}>{signedAmount(delta.amount)}</Text>
            <Text style={[styles.deltaPct, tone]}>{signedPercent(delta.pct)}</Text>
            <Text style={styles.deltaVs}>vs {previous}</Text>
        </View>
    );
}

export default function NetWorthScreen() {
    const accounts = useAccounts();
    const holdings = useHoldings();
    const snapshots = useSnapshots();
    const groupRows = useGroups();

    const [scope, setScope] = useState<Scope>(ALL_GROUPS);
    const [focused, setFocused] = useState<string | null>(null);

    const queries = [accounts, holdings, snapshots, groupRows];
    const refreshing = queries.some((query) => query.isRefetching);
    const refresh = () => queries.forEach((query) => void query.refetch());

    if (accounts.isPending || holdings.isPending || snapshots.isPending || groupRows.isPending) {
        return (
            <Screen>
                <Status text="Loading…" busy />
            </Screen>
        );
    }
    if (accounts.isError || holdings.isError || snapshots.isError || groupRows.isError) {
        return (
            <Screen refreshing={refreshing} onRefresh={refresh}>
                <Status text="Could not load accounts. Pull to retry." />
            </Screen>
        );
    }

    const allGroups = groupRows.data;
    const groups = netWorthGroups(netWorthItems(accounts.data, holdings.data), allGroups);
    const selected = groups.find((entry) => entry.group.id === scope);
    const scoped = itemsInScope(groups, scope);
    const total = scoped.reduce((sum, item) => addCents(sum, item.value), cents(0));
    const slices = netWorthSlices(scoped, allGroups, selected ? owesMoney(selected.total) : false);

    const months = snapshots.data;
    const delta = deltaAt(seriesFor(months, scope), months.length - 1);
    const previous = months[months.length - 2]?.period;

    const liveAssets = groups
        .filter((entry) => !owesMoney(entry.total))
        .reduce((sum, entry) => addCents(sum, entry.total), cents(0));
    const centre = scope !== ALL_GROUPS ? total : liveAssets;

    const choose = (next: Scope) => {
        setScope(next);
        setFocused(null);
    };

    return (
        <Screen refreshing={refreshing} onRefresh={refresh}>
            <View style={styles.summary}>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.groups}
                >
                    {[{ id: ALL_GROUPS, name: ALL_GROUPS_LABEL }, ...allGroups].map((group) => (
                        <Pressable
                            key={group.id}
                            onPress={() => choose(group.id)}
                            style={[styles.group, scope === group.id && styles.groupActive]}
                        >
                            <Text
                                style={[
                                    styles.groupText,
                                    scope === group.id && styles.groupTextActive,
                                ]}
                            >
                                {group.name}
                            </Text>
                        </Pressable>
                    ))}
                </ScrollView>
                <Text style={text.kicker}>{kickerFor(selected)}</Text>
                <View style={styles.netWorth}>
                    <Text style={styles.currency}>{total < 0 ? "−€" : "€"}</Text>
                    <Text style={styles.amount} numberOfLines={1} adjustsFontSizeToFit>
                        {formatAmount(total)}
                    </Text>
                </View>
                {delta && (
                    <DeltaLine
                        delta={delta}
                        previous={previous ? monthName(previous, "long") : "start"}
                    />
                )}
            </View>

            {scoped.length > 0 && (
                <View style={styles.section}>
                    <Text style={text.kicker}>Made of</Text>
                    <Donut
                        slices={slices}
                        focused={focused}
                        onFocus={setFocused}
                        label={centreLabel(selected)}
                        value={shortEuros(centre)}
                    />
                </View>
            )}

            <RecentTransactions accounts={accounts.data} scope={scope} />
        </Screen>
    );
}

const styles = StyleSheet.create({
    summary: { gap: 6 },
    groups: { gap: 6, marginBottom: 2 },
    group: {
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: radius.md * 0.75,
        borderWidth: 1,
        borderColor: colors.divider,
    },
    groupActive: { backgroundColor: colors.accentSoft, borderColor: colors.accentSoft },
    groupText: {
        fontFamily: fonts.regular,
        fontSize: 11.5,
        letterSpacing: 0.2,
        color: colors.quiet,
    },
    groupTextActive: { color: colors.accentInk },
    netWorth: { flexDirection: "row", alignItems: "center", gap: 8 },
    currency: { fontFamily: fonts.medium, fontSize: 30, color: colors.subtle },
    amount: {
        flexShrink: 1,
        fontFamily: fonts.medium,
        fontSize: 48,
        letterSpacing: -1.6,
        color: colors.text,
        fontVariant: ["tabular-nums", "lining-nums"],
    },
    delta: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 },
    deltaAmount: {
        fontFamily: fonts.regular,
        fontSize: 13,
        color: colors.text,
        fontVariant: ["tabular-nums"],
    },
    deltaPct: { fontFamily: fonts.regular, fontSize: 13, color: colors.text, opacity: 0.7 },
    deltaVs: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
    up: { color: colors.accentStrong },
    section: { gap: space[6] },
});
