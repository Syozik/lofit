import { useTags, useTransactions } from "@lofit/api";
import { ALL_GROUPS, byRecency, forAccounts } from "@lofit/domain";
import type { Account, Scope } from "@lofit/domain";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useOpenEntry } from "../context/entry";
import { useRemoveTransaction } from "../hooks/useRemoveTransaction";
import type { Colors } from "../theme";
import { fonts, space, useStyles } from "../theme";
import { makeText } from "./Screen";
import { TransactionRow } from "./TransactionRow";

const STEP = 10;

type Props = {
    accounts: readonly Account[];
    scope: Scope;
};

export function RecentTransactions({ accounts, scope }: Props) {
    const styles = useStyles(makeStyles);
    const text = useStyles(makeText);
    const [recentCount, setRecentCount] = useState(STEP);
    const transactions = useTransactions();
    const tags = useTags();
    const remove = useRemoveTransaction();
    const openEntry = useOpenEntry();

    if (transactions.isPending) return null;
    if (transactions.isError) return <Text style={text.muted}>Could not load activity</Text>;

    const accountNames = new Map(accounts.map((account) => [account.id, account.name]));
    const tagNames = new Map((tags.data ?? []).map((tag) => [tag.id, tag.name]));
    const scoped =
        scope === ALL_GROUPS
            ? transactions.data
            : forAccounts(
                  transactions.data,
                  new Set(
                      accounts
                          .filter((account) => account.groupId === scope)
                          .map((account) => account.id),
                  ),
              );
    const recent = byRecency(scoped).slice(0, recentCount);

    return (
        <View style={styles.section}>
            <View style={styles.head}>
                <Text style={text.kicker}>Recent</Text>
                <Pressable
                    hitSlop={8}
                    onPress={() => router.navigate("/spending")}
                    style={styles.action}
                >
                    <Text style={styles.actionText}>All activity</Text>
                </Pressable>
            </View>
            {recent.length === 0 ? (
                <Text style={text.muted}>No activity on these accounts yet</Text>
            ) : (
                <>
                    <View>
                        {recent.map((transaction) => (
                            <TransactionRow
                                key={transaction.id}
                                transaction={transaction}
                                accountNames={accountNames}
                                tagNames={tagNames}
                                onEdit={openEntry}
                                onDelete={remove}
                            />
                        ))}
                    </View>
                    {recentCount < scoped.length && (
                        <Pressable hitSlop={8} onPress={() => setRecentCount(recentCount + STEP)}>
                            <Text style={styles.actionText}>Load more</Text>
                        </Pressable>
                    )}
                </>
            )}
        </View>
    );
}

const makeStyles = (colors: Colors) =>
    StyleSheet.create({
        section: { gap: space[4] },
        head: { flexDirection: "row", alignItems: "center" },
        action: { marginLeft: "auto" },
        actionText: { fontFamily: fonts.medium, fontSize: 13, color: colors.accent },
    });
