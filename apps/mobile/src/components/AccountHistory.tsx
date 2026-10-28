import { useTags, useTransactions } from "@lofit/api";
import { cents, forAccounts } from "@lofit/domain";
import type { Account } from "@lofit/domain";
import { historyByMonth, monthName, signedAmount, yearOf } from "@lofit/view";
import { StyleSheet, Text, View } from "react-native";
import { useOpenEntry } from "../context/entry";
import { useRemoveTransaction } from "../hooks/useRemoveTransaction";
import type { Colors } from "../theme";
import { fonts, space, useStyles, useTheme } from "../theme";
import { makeText } from "./Screen";
import { Sheet } from "./Sheet";
import { TransactionRow } from "./TransactionRow";

type Props = {
    account: Account;
    accounts: readonly Account[];
    onClose: () => void;
};

export function AccountHistory({ account, accounts, onClose }: Props) {
    const { colors } = useTheme();
    const styles = useStyles(makeStyles);
    const text = useStyles(makeText);
    const transactions = useTransactions();
    const tags = useTags();
    const remove = useRemoveTransaction();
    const openEntry = useOpenEntry();

    const accountNames = new Map(accounts.map((entry) => [entry.id, entry.name]));
    const tagNames = new Map((tags.data ?? []).map((tag) => [tag.id, tag.name]));
    const mine = forAccounts(transactions.data ?? [], new Set([account.id]));
    const months = historyByMonth(mine, account.id);
    const thisYear = new Date().getUTCFullYear().toString();

    return (
        <Sheet
            title={account.name}
            note={`${mine.length} ${mine.length === 1 ? "entry" : "entries"}`}
            onClose={onClose}
        >
            {transactions.isPending ? (
                <Text style={text.muted}>Loading…</Text>
            ) : transactions.isError ? (
                <Text style={text.muted}>Could not load activity</Text>
            ) : months.length === 0 ? (
                <Text style={text.muted}>No activity on this account yet</Text>
            ) : (
                months.map((month) => (
                    <View key={month.period} style={styles.month}>
                        <View style={styles.head}>
                            <Text style={text.kicker}>
                                {monthName(month.period, "long")}
                                {yearOf(month.period) === thisYear
                                    ? ""
                                    : ` ${yearOf(month.period)}`}
                            </Text>
                            <Text style={[styles.net, month.net > 0 && styles.up]}>
                                {signedAmount(cents(month.net))}
                            </Text>
                        </View>
                        <View>
                            {month.entries.map((transaction) => (
                                <TransactionRow
                                    key={transaction.id}
                                    transaction={transaction}
                                    accountNames={accountNames}
                                    tagNames={tagNames}
                                    viewedFrom={account.id}
                                    onEdit={openEntry}
                                    onDelete={remove}
                                    surface={colors.surface}
                                />
                            ))}
                        </View>
                    </View>
                ))
            )}
        </Sheet>
    );
}

const makeStyles = (colors: Colors) =>
    StyleSheet.create({
        month: { gap: space[3] },
        head: { flexDirection: "row", alignItems: "baseline" },
        net: {
            marginLeft: "auto",
            fontFamily: fonts.regular,
            fontSize: 12,
            color: colors.muted,
            fontVariant: ["tabular-nums"],
        },
        up: { color: colors.accentStrong },
    });
