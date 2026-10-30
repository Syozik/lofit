import { useAccounts, useBudgets, useRecurring, useTags, useTransactions } from "@lofit/api";
import { byRecency, cadenceLabel, earliestPeriod, formatAmount, inPeriod, periodOf, shiftPeriod, spendByTag, tagsFor, withSymbol } from "@lofit/domain";
import type { Transaction } from "@lofit/domain";
import {
    budgetStatus,
    dayFormat,
    filterOptions,
    filterTransactions,
    isFiltered,
    litSlices,
    matchedKeys,
    NO_FILTER,
    shortMoney,
    spendSlices,
    toggled,
    toggledAll,
    UNTAGGED_KEY,
    upcomingSpend,
} from "@lofit/view";
import type { SpendFilter } from "@lofit/view";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BudgetRow, Meter, StatusNote } from "../../components/BudgetMeter";
import { BudgetsSheet } from "../../components/BudgetsSheet";
import { Donut } from "../../components/Donut";
import { ListScreen, Screen, Status, makeText } from "../../components/Screen";
import { SpendFilters } from "../../components/SpendFilters";
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
    const recurring = useRecurring();
    const remove = useRemoveTransaction();
    const openEntry = useOpenEntry();
    const [filter, setFilter] = useState<SpendFilter>(NO_FILTER);
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
    }

    const expenseIds = new Set(tagsFor(tags.data, "expense").map((tag) => tag.id));
    const expenseBudgets = budgets.data.filter((budget) => expenseIds.has(budget.tagId));
    const accountNames = new Map(accounts.data.map((account) => [account.id, account.name]));
    const tagNames = new Map(tags.data.map((tag) => [tag.id, tag.name]));
    const monthly = inPeriod(transactions.data, period);
    const filtered = isFiltered(filter);
    const shown = filtered ? filterTransactions(monthly, filter, tagNames, accountNames) : monthly;
    const options = filterOptions(monthly, tags.data, accountNames, filter);
    const summary = spendByTag(monthly, expenseBudgets, tags.data, period);
    const matching = spendByTag(shown, expenseBudgets, tags.data, period);
    const matched = matchedKeys(matching);
    const { slices, tagsOf } = spendSlices(summary.tags, tags.data);
    const lit = filtered ? litSlices(tagsOf, matched) : undefined;
    const activity = byRecency(shown);
    const spentByTag = new Map(summary.tags.flatMap((row) => (row.tagId ? [[row.tagId, row.spent] as const] : [])));
    const due = upcomingSpend(recurring.data ?? [], period, new Date().toISOString().slice(0, 10));
    const total = budgetStatus(summary.spent, summary.budgeted, period, due.total);
    const budgeted = summary.tags.flatMap((row) => (row.budget ? [{ ...row, limit: row.budget.limit }] : []));

    function focusSlice(key: string | null) {
        const group = key ? tagsOf.get(key) : undefined;
        setFilter({ ...filter, tagIds: group ? toggledAll(filter.tagIds, group) : [] });
    }

    function toggleTag(tagId: string) {
        setFilter({ ...filter, tagIds: toggled(filter.tagIds, tagId) });
    }

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
                    <Text style={styles.amount}>{withSymbol(formatAmount(summary.spent))}</Text>
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
                            <Text style={styles.of}>of {withSymbol(formatAmount(summary.budgeted))}</Text>
                            <StatusNote status={total} style={styles.left} />
                        </>
                    ) : (
                        <Text style={styles.setBudget}>Set a budget</Text>
                    )}
                </Pressable>
            </View>

            {summary.budgeted > 0 && <Meter status={total} thick />}

            <SpendFilters filter={filter} options={options} onChange={setFilter} />

            {slices.length > 0 && (
                <Donut
                    slices={slices}
                    focused={null}
                    lit={lit}
                    onFocus={focusSlice}
                    label={filtered ? "Matching" : "Spent"}
                    value={shortMoney(filtered ? matching.spent : summary.spent)}
                />
            )}

            {budgeted.length > 0 && (
                <View>
                    <View style={styles.sectionHead}>
                        <Text style={text.kicker}>Budgets</Text>
                        <Pressable hitSlop={8} onPress={() => setEditingBudgets(true)} style={styles.showAll}>
                            <Text style={styles.showAllText}>Edit</Text>
                        </Pressable>
                    </View>
                    {budgeted.map((row) => (
                        <BudgetRow
                            key={row.tagId ?? "untagged"}
                            label={row.label}
                            spent={row.spent}
                            limit={row.limit}
                            period={period}
                            upcoming={due.byTag.get(row.tagId ?? UNTAGGED_KEY) ?? 0}
                            selected={filter.tagIds.includes(row.tagId ?? UNTAGGED_KEY)}
                            dimmed={filtered && !matched.has(row.tagId ?? UNTAGGED_KEY)}
                            onPress={() => toggleTag(row.tagId ?? UNTAGGED_KEY)}
                        />
                    ))}
                </View>
            )}

            {due.items.length > 0 && (
                <View>
                    <View style={styles.sectionHead}>
                        <Text style={text.kicker}>Upcoming</Text>
                    </View>
                    {due.items.map(({ recurring: item, day }) => (
                        <View key={`${item.id}-${day}`} style={styles.upcoming}>
                            <Text style={styles.upcomingDay}>{dayFormat.format(new Date(`${day}T00:00:00Z`))}</Text>
                            <View style={styles.upcomingText}>
                                <Text style={styles.upcomingName} numberOfLines={1}>
                                    {item.name}
                                </Text>
                                <Text style={styles.upcomingHow}>{cadenceLabel(item)} · logs itself</Text>
                            </View>
                            <Text style={styles.upcomingAmount}>
                                {item.shown > 0 ? "+" : "−"}
                                {withSymbol(formatAmount(item.shown))}
                            </Text>
                        </View>
                    ))}
                </View>
            )}

            <View style={styles.sectionHead}>
                <Text style={text.kicker}>{filtered ? "Matching activity" : "All activity"}</Text>
                {filtered && (
                    <Pressable hitSlop={8} onPress={() => setFilter(NO_FILTER)} style={styles.showAll}>
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
                empty={
                    <Text style={styles.empty}>
                        {filtered
                            ? `Nothing in ${formatPeriod(period, monthFormat)} matches`
                            : `No activity in ${formatPeriod(period, monthFormat)}`}
                    </Text>
                }
                keyExtractor={(transaction) => transaction.id}
                renderItem={({ item }) => (
                    <TransactionRow
                        transaction={item}
                        accountNames={accountNames}
                        tagNames={tagNames}
                        onEdit={openEntry}
                        onDelete={remove}
                        onTag={toggleTag}
                        selectedTags={filter.tagIds}
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
        upcoming: {
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            paddingVertical: 9,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.divider,
        },
        upcomingDay: { width: 46, fontFamily: fonts.regular, fontSize: 12, color: colors.muted, fontVariant: ["tabular-nums"] },
        upcomingText: { flex: 1, gap: 2 },
        upcomingName: { fontFamily: fonts.regular, fontSize: 14, color: colors.text },
        upcomingHow: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted },
        upcomingAmount: { fontFamily: fonts.regular, fontSize: 14, color: colors.text, fontVariant: ["tabular-nums"] },
        showAll: { marginLeft: "auto" },
        showAllText: { fontFamily: fonts.medium, fontSize: 13, color: colors.accent },
    });
