import { useAccounts, useBudgets, useTags, useTransactions } from "@lofit/api";
import { byRecency, formatAmount, latestPeriod, primaryTagId, spendByTag } from "@lofit/domain";
import type { Transaction } from "@lofit/domain";
import { shortEuros, spendSlices, UNTAGGED_KEY } from "@lofit/view";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Donut } from "../../components/Donut";
import { ListScreen, Screen, Status, text } from "../../components/Screen";
import { TransactionRow } from "../../components/TransactionRow";
import { useOpenEntry } from "../../context/entry";
import { useRemoveTransaction } from "../../hooks/useRemoveTransaction";
import { colors, fonts, space } from "../../theme";

const monthFormat = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

function formatPeriod(period: string): string {
    return monthFormat.format(new Date(`${period}-01T00:00:00Z`));
}

export default function SpendingScreen() {
    const transactions = useTransactions();
    const budgets = useBudgets();
    const accounts = useAccounts();
    const tags = useTags();
    const remove = useRemoveTransaction();
    const openEntry = useOpenEntry();
    const [focused, setFocused] = useState<string | null>(null);

    const queries = [transactions, budgets, accounts, tags];
    const refreshing = queries.some((query) => query.isRefetching);
    const reload = () => queries.forEach((query) => void query.refetch());

    if (transactions.isPending || budgets.isPending || accounts.isPending || tags.isPending) {
        return (
            <Screen>
                <Status text="Loading…" busy />
            </Screen>
        );
    }
    if (transactions.isError || budgets.isError || accounts.isError || tags.isError) {
        return (
            <Screen refreshing={refreshing} onRefresh={reload}>
                <Status text="Could not load spending. Pull to retry." />
            </Screen>
        );
    }

    const period = latestPeriod(transactions.data);
    if (!period) {
        return (
            <Screen refreshing={refreshing} onRefresh={reload}>
                <Status text="No activity yet" />
            </Screen>
        );
    }

    const summary = spendByTag(transactions.data, budgets.data, tags.data, period);
    const accountNames = new Map(accounts.data.map((account) => [account.id, account.name]));
    const tagNames = new Map(tags.data.map((tag) => [tag.id, tag.name]));
    const { slices, tagsOf } = spendSlices(summary.tags, tags.data);
    const focusedTags = focused ? tagsOf.get(focused) : undefined;
    const activity = byRecency(
        focusedTags
            ? transactions.data.filter((transaction) => focusedTags.has(primaryTagId(transaction) ?? UNTAGGED_KEY))
            : transactions.data,
    );
    const focusedLabel = focusedTags ? slices.find((slice) => slice.key === focused)?.label : undefined;

    const header = (
        <>
            <View style={styles.head}>
                <View style={styles.totalBlock}>
                    <Text style={text.kicker}>Spent in {formatPeriod(period)}</Text>
                    <Text style={styles.amount}>€ {formatAmount(summary.spent)}</Text>
                </View>
                <View style={styles.budget}>
                    <Text style={styles.of}>of € {formatAmount(summary.budgeted)}</Text>
                    <Text style={styles.left}>€ {formatAmount(summary.left)} left</Text>
                </View>
            </View>

            {slices.length > 0 && (
                <Donut
                    slices={slices}
                    focused={focusedTags ? focused : null}
                    onFocus={setFocused}
                    label="Spent"
                    value={shortEuros(summary.spent)}
                />
            )}

            <View style={styles.sectionHead}>
                <Text style={text.kicker}>{focusedLabel ?? "All activity"}</Text>
                {focusedTags && (
                    <Pressable hitSlop={8} onPress={() => setFocused(null)} style={styles.showAll}>
                        <Text style={styles.showAllText}>Show all</Text>
                    </Pressable>
                )}
            </View>
        </>
    );

    return (
        <ListScreen<Transaction>
            header={header}
            data={activity}
            keyExtractor={(transaction) => transaction.id}
            renderItem={({ item }) => (
                <TransactionRow
                    transaction={item}
                    accountNames={accountNames}
                    tagNames={tagNames}
                    onEdit={openEntry}
                    onDelete={remove}
                />
            )}
            refreshing={refreshing}
            onRefresh={reload}
        />
    );
}

const styles = StyleSheet.create({
    head: { flexDirection: "row", alignItems: "flex-end", gap: space[6] },
    totalBlock: { gap: 4 },
    amount: { fontFamily: fonts.medium, fontSize: 30, letterSpacing: -0.6, color: colors.text, fontVariant: ["tabular-nums"] },
    budget: { marginLeft: "auto", alignItems: "flex-end", gap: 2 },
    of: { fontFamily: fonts.regular, fontSize: 12, color: colors.quiet, fontVariant: ["tabular-nums"] },
    left: { fontFamily: fonts.regular, fontSize: 12, color: colors.accentStrong, fontVariant: ["tabular-nums"] },
    sectionHead: { flexDirection: "row", alignItems: "center" },
    showAll: { marginLeft: "auto" },
    showAllText: { fontFamily: fonts.medium, fontSize: 13, color: colors.accent },
});
