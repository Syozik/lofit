import {
    INITIAL_TREND,
    useAccounts,
    useGroups,
    useHoldings,
    useNetWorthTrend,
    useSnapshots,
} from "@lofit/api";
import {
    addCents,
    ALL_GROUPS,
    ALL_GROUPS_LABEL,
    amountIn,
    byPosition,
    cents,
    deltaAt,
    formatAmount,
    itemsInScope,
    lastBefore,
    netWorthGroups,
    netWorthItems,
    owesMoney,
    seriesFor,
} from "@lofit/domain";
import type { Account, Delta, Group, Holding, Scope, Snapshot } from "@lofit/domain";
import {
    centreLabel,
    groupColor,
    kickerFor,
    monthName,
    netWorthSlices,
    shortEuros,
    signedAmount,
    signedPercent,
} from "@lofit/view";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Segmented } from "../../components/Choices";
import { Donut } from "../../components/Donut";
import { NetWorthTrend } from "../../components/NetWorthTrend";
import type { TrendPart } from "../../components/NetWorthTrend";
import { RecentTransactions } from "../../components/RecentTransactions";
import { Screen, Status, makeText } from "../../components/Screen";
import type { Colors } from "../../theme";
import { fonts, radius, space, useStyles, useTheme } from "../../theme";

type ChartMode = "mix" | "trend";

const CHART_MODES = [
    { value: "mix", label: "Mix" },
    { value: "trend", label: "Trend" },
] as const;

function DeltaLine({ delta, previous }: { delta: Delta; previous: string }) {
    const styles = useStyles(makeStyles);
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

    return (
        <NetWorthBody
            accounts={accounts.data}
            holdings={holdings.data}
            snapshots={snapshots.data}
            allGroups={groupRows.data}
            refreshing={refreshing}
            onRefresh={refresh}
        />
    );
}

type BodyProps = {
    accounts: readonly Account[];
    holdings: readonly Holding[];
    snapshots: readonly Snapshot[];
    allGroups: readonly Group[];
    refreshing: boolean;
    onRefresh: () => void;
};

function NetWorthBody({
    accounts,
    holdings,
    snapshots,
    allGroups,
    refreshing,
    onRefresh,
}: BodyProps) {
    const { tokenColor } = useTheme();
    const styles = useStyles(makeStyles);
    const text = useStyles(makeText);
    const [scope, setScope] = useState<Scope>(ALL_GROUPS);
    const [mode, setMode] = useState<ChartMode>("mix");
    const [focused, setFocused] = useState<string | null>(null);

    const groups = netWorthGroups(netWorthItems(accounts, holdings), allGroups);
    const selected = groups.find((entry) => entry.group.id === scope);
    const scoped = itemsInScope(groups, scope);
    const live = scoped.reduce((sum, item) => addCents(sum, item.value), cents(0));
    const slices = netWorthSlices(scoped, allGroups, selected ? owesMoney(selected.total) : false);

    const investing = allGroups.find((group) => group.id === scope && group.invests)?.id;
    const selection = useState(INITIAL_TREND);
    const trend = useNetWorthTrend(scope, investing, snapshots, live, selection);
    const trending = mode === "trend";
    const total = trending ? (trend.shown?.value ?? live) : live;
    const kicker =
        trending && trend.focusLabel
            ? `${kickerFor(selected)} · ${trend.focusLabel}`
            : kickerFor(selected);

    const monthStart = `${new Date().toISOString().slice(0, 7)}-01`;
    const baseline = lastBefore(snapshots, monthStart);
    const monthDelta = baseline ? deltaAt([...seriesFor([baseline], scope), live], 1) : undefined;
    const delta = trending ? trend.delta : monthDelta;
    const previous = trending
        ? trend.since
        : baseline
          ? monthName(baseline.day.slice(0, 7), "long")
          : "start";

    const past = trend.focusSnapshot;
    const parts: TrendPart[] =
        scope === ALL_GROUPS
            ? byPosition(allGroups)
                  .map((group) => ({
                      group,
                      value: past
                          ? amountIn(past, group.id)
                          : (groups.find((entry) => entry.group.id === group.id)?.total ??
                            cents(0)),
                  }))
                  .filter((entry) => entry.value !== 0)
                  .map(({ group, value }) => ({
                      id: group.id,
                      label: group.name,
                      value,
                      color: tokenColor(groupColor(group.position, value < 0)),
                  }))
            : [];

    const liveAssets = groups
        .filter((entry) => !owesMoney(entry.total))
        .reduce((sum, entry) => addCents(sum, entry.total), cents(0));
    const centre = scope !== ALL_GROUPS ? live : liveAssets;

    const choose = (next: Scope) => {
        setScope(next);
        setFocused(null);
        trend.setHover(null);
    };

    return (
        <Screen refreshing={refreshing} onRefresh={onRefresh}>
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
                <Text style={text.kicker}>{kicker}</Text>
                <View style={styles.netWorth}>
                    <Text style={styles.currency}>{total < 0 ? "−€" : "€"}</Text>
                    <Text style={styles.amount} numberOfLines={1} adjustsFontSizeToFit>
                        {formatAmount(total)}
                    </Text>
                </View>
                {delta && <DeltaLine delta={delta} previous={previous} />}
            </View>

            {scoped.length > 0 && (
                <View style={styles.section}>
                    <View style={styles.chartHead}>
                        <Text style={text.kicker}>{trending ? "Trend" : "Made of"}</Text>
                        <Segmented
                            options={CHART_MODES}
                            value={mode}
                            onChange={(next) => {
                                setMode(next);
                                trend.setHover(null);
                            }}
                        />
                    </View>
                    {trending ? (
                        <NetWorthTrend trend={trend} parts={parts} />
                    ) : (
                        <Donut
                            slices={slices}
                            focused={focused}
                            onFocus={setFocused}
                            label={centreLabel(selected)}
                            value={shortEuros(centre)}
                        />
                    )}
                </View>
            )}

            <RecentTransactions accounts={accounts} scope={scope} />
        </Screen>
    );
}

const makeStyles = (colors: Colors) =>
    StyleSheet.create({
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
        chartHead: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
        },
    });
