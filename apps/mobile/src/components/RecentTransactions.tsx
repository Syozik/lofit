import { useTags, useTransactions } from "@lofit/api";
import { ALL_GROUPS, byRecency, forAccounts } from "@lofit/domain";
import type { Account, Scope } from "@lofit/domain";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fonts, space } from "../theme";
import { text } from "./Screen";
import { TransactionRow } from "./TransactionRow";

const RECENT_COUNT = 5;

type Props = {
    accounts: readonly Account[];
    scope: Scope;
};

export function RecentTransactions({ accounts, scope }: Props) {
    const transactions = useTransactions();
    const tags = useTags();

    if (transactions.isPending) return null;
    if (transactions.isError) return <Text style={text.muted}>Could not load activity</Text>;

    const accountNames = new Map(accounts.map((account) => [account.id, account.name]));
    const tagNames = new Map((tags.data ?? []).map((tag) => [tag.id, tag.name]));
    const scoped =
        scope === ALL_GROUPS
            ? transactions.data
            : forAccounts(
                  transactions.data,
                  new Set(accounts.filter((account) => account.groupId === scope).map((account) => account.id)),
              );
    const recent = byRecency(scoped).slice(0, RECENT_COUNT);

    return (
        <View style={styles.section}>
            <View style={styles.head}>
                <Text style={text.kicker}>Recent</Text>
                <Pressable hitSlop={8} onPress={() => router.navigate("/spending")} style={styles.action}>
                    <Text style={styles.actionText}>All activity</Text>
                </Pressable>
            </View>
            {recent.length === 0 ? (
                <Text style={text.muted}>No activity on these accounts yet</Text>
            ) : (
                <View>
                    {recent.map((transaction) => (
                        <TransactionRow
                            key={transaction.id}
                            transaction={transaction}
                            accountNames={accountNames}
                            tagNames={tagNames}
                        />
                    ))}
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    section: { gap: space[4] },
    head: { flexDirection: "row", alignItems: "center" },
    action: { marginLeft: "auto" },
    actionText: { fontFamily: fonts.medium, fontSize: 13, color: colors.accent },
});
