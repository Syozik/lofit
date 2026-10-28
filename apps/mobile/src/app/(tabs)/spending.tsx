import { useAccounts, useBudgets, useTags, useTransactions } from "@lofit/api";
import { byRecency, earliestPeriod, formatAmount, inPeriod, periodOf, primaryTagId, shiftPeriod, spendByTag, tagsFor } from "@lofit/domain";
import type { Transaction } from "@lofit/domain";
import { shortEuros, spendSlices, UNTAGGED_KEY } from "@lofit/view";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BudgetsSheet } from "../../components/BudgetsSheet";
import { Donut } from "../../components/Donut";
import { ListScreen, Screen, Status, makeText } from "../../components/Screen";
import { TransactionRow } from "../../components/TransactionRow";
import { useOpenEntry } from "../../context/entry";
import { useRemoveTransaction } from "../../hooks/useRemoveTransaction";
import type { Colors } from "../../theme";
import { fonts, space, useStyles, useTheme } from "../../theme";

const periodFormat = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
const monthFormat = new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "UTC" });

function formatPeriod(period: string, format = periodFormat): string {
    return format.format(new Date(`${period}-01T00:00:00Z`));
}

function currentPeriod(): string {
    return periodOf(new Date().toISOString());
}

export default function SpendingScreen() {
    const { colors } = useTheme();
    const styles = useStyles(makeStyles);
    const text = useStyles(makeText);
    const transactions = useTransactions();
    const budgets = useBudgets();
    const accounts = useAccounts();
    const tags = useTags();
    const remove = useRemoveTransaction();
    const openEntry = useOpenEntry();
    const [focused, setFocused] = useState<string | null>(null);
    const [period, setPeriod] = useState(currentPeriod);
    const [editingBudgets, setEditingBudgets] = useState(false);

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

    const current = currentPeriod();
    const earliest = earliestPeriod(transactions.data) ?? current;
    const canGoBack = period > earliest;
    const canGoForward = period < current;

    function shift(months: number) {
        setPeriod((value) => shiftPeriod(value, months));
        setFocused(null);
    }

    const expenseIds = new Set(tagsFor(tags.data, "expense").map((tag) => tag.id));
    const expenseBudgets = budgets.data.filter((budget) => expenseIds.has(budget.tagId));
    const summary = spendByTag(transactions.data, expenseBudgets, tags.data, period);
    const accountNames = new Map(accounts.data.map((account) => [account.id, account.name]));
    const tagNames = new Map(tags.data.map((tag) => [tag.id, tag.name]));
    const { slices, tagsOf } = spendSlices(summary.tags, tags.data);
    const focusedTags = focused ? tagsOf.get(focused) : undefined;
    const monthly = inPeriod(transactions.data, period);
    const activity = byRecency(
        focusedTags
            ? monthly.filter((transaction) => focusedTags.has(primaryTagId(transaction) ?? UNTAGGED_KEY))
            : monthly,
    );
    const spentByTag = new Map(summary.tags.flatMap((row) => (row.tagId ? [[row.tagId, row.spent] as const] : [])));
    const focusedLabel = focusedTags ? slices.find((slice) => slice.key === focused)?.label : undefined;

    const header = (
        <>
            <View style={styles.head}>
                <View style={styles.totalBlock}>
                    <View style={styles.monthRow}>
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="Previous month"
                            accessibilityState={{ disabled: !canGoBack }}
                            disabled={!canGoBack}
                            hitSlop={10}
                            onPress={() => shift(-1)}
                        >
                            <ChevronLeft size={16} color={canGoBack ? colors.quiet : colors.chip} />
                        </Pressable>
                        <View>
                            <Text style={[text.kicker, styles.widest]}>September {period.slice(0, 4)}</Text>
                            <Text style={[text.kicker, styles.month]}>{formatPeriod(period)}</Text>
                        </View>
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="Next month"
                            accessibilityState={{ disabled: !canGoForward }}
                            disabled={!canGoForward}
                            hitSlop={10}
                            onPress={() => shift(1)}
                        >
                            <ChevronRight size={16} color={canGoForward ? colors.quiet : colors.chip} />
                        </Pressable>
                    </View>
                    <Text style={styles.amount}>€ {formatAmount(summary.spent)}</Text>
                </View>
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Edit budgets"
                    hitSlop={8}
                    onPress={() => setEditingBudgets(true)}
                    style={({ pressed }) => [styles.budget, pressed && styles.pressed]}
                >
                    {summary.budgeted > 0 ? (
                        <>
                            <Text style={styles.of}>of € {formatAmount(summary.budgeted)}</Text>
                            <Text style={styles.left}>€ {formatAmount(summary.left)} left</Text>
                        </>
                    ) : (
                        <Text style={styles.setBudget}>Set a budget</Text>
                    )}
                </Pressable>
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
        <>
            <ListScreen<Transaction>
                header={header}
                data={activity}
                empty={<Text style={styles.empty}>No activity in {formatPeriod(period, monthFormat)}</Text>}
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
            {editingBudgets && (
                <BudgetsSheet
                    tags={tags.data}
                    budgets={expenseBudgets}
                    spent={spentByTag}
                    month={formatPeriod(period, monthFormat)}
                    onClose={() => setEditingBudgets(false)}
                />
            )}
        </>
    );
}

const makeStyles = (colors: Colors) =>
    StyleSheet.create({
        head: { flexDirection: "row", alignItems: "flex-end", gap: space[6] },
        totalBlock: { gap: 4 },
        widest: { opacity: 0 },
        month: { position: "absolute", left: 0, right: 0, textAlign: "center" },
        monthRow: { flexDirection: "row", alignItems: "center", gap: 6, marginLeft: -2 },
        amount: { fontFamily: fonts.medium, fontSize: 30, letterSpacing: -0.6, color: colors.text, fontVariant: ["tabular-nums"] },
        budget: { marginLeft: "auto", alignItems: "flex-end", gap: 2 },
        of: { fontFamily: fonts.regular, fontSize: 12, color: colors.quiet, fontVariant: ["tabular-nums"] },
        setBudget: { fontFamily: fonts.medium, fontSize: 13, color: colors.accent },
        pressed: { opacity: 0.55 },
        empty: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, paddingVertical: space[6] },
        left: { fontFamily: fonts.regular, fontSize: 12, color: colors.accentStrong, fontVariant: ["tabular-nums"] },
        sectionHead: { flexDirection: "row", alignItems: "center" },
        showAll: { marginLeft: "auto" },
        showAllText: { fontFamily: fonts.medium, fontSize: 13, color: colors.accent },
    });
