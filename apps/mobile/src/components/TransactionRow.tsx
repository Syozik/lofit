import { cents, formatAmount } from "@lofit/domain";
import type { Transaction } from "@lofit/domain";
import { amountFor, monogram, transactionMeta } from "@lofit/view";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fonts, radius } from "../theme";
import { SwipeRow } from "./SwipeRow";

type Props = {
    transaction: Transaction;
    accountNames: ReadonlyMap<string, string>;
    tagNames: ReadonlyMap<string, string>;
    viewedFrom?: string;
    onPress?: (transaction: Transaction) => void;
    onEdit?: (transaction: Transaction) => void;
    onDelete?: (transaction: Transaction) => void;
    surface?: string;
};

export function TransactionRow({
    transaction,
    accountNames,
    tagNames,
    viewedFrom,
    onPress,
    onEdit,
    onDelete,
    surface,
}: Props) {
    const amount = amountFor(transaction, viewedFrom);

    const row = (
        <Pressable
            disabled={!onPress}
            onPress={() => onPress?.(transaction)}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        >
            <View style={styles.mono}>
                <Text style={styles.monoText}>{monogram(transaction)}</Text>
            </View>
            <View style={styles.text}>
                <Text style={styles.name} numberOfLines={1}>
                    {transaction.name}
                </Text>
                <Text style={styles.meta} numberOfLines={1}>
                    {transactionMeta(transaction, accountNames, tagNames, viewedFrom)}
                </Text>
            </View>
            <Text style={[styles.amount, amount > 0 ? styles.positive : null]}>
                {amount > 0 ? "+ € " : "− € "}
                {formatAmount(cents(amount))}
            </Text>
        </Pressable>
    );

    if (!onDelete) return row;

    return (
        <SwipeRow
            label={transaction.name}
            onEdit={onEdit ? () => onEdit(transaction) : undefined}
            onDelete={() => onDelete(transaction)}
            {...(surface ? { surface } : {})}
        >
            {row}
        </SwipeRow>
    );
}

const styles = StyleSheet.create({
    row: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 11,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.divider,
    },
    pressed: { opacity: 0.6 },
    mono: {
        width: 32,
        height: 32,
        borderRadius: radius.sm,
        backgroundColor: colors.surface,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.divider,
        alignItems: "center",
        justifyContent: "center",
    },
    monoText: { fontFamily: fonts.medium, fontSize: 12, color: colors.quiet },
    text: { flex: 1, minWidth: 0, gap: 2 },
    name: { fontFamily: fonts.regular, fontSize: 14, color: colors.text },
    meta: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted },
    amount: {
        fontFamily: fonts.regular,
        fontSize: 14,
        color: colors.text,
        fontVariant: ["tabular-nums"],
    },
    positive: { color: colors.accentStrong },
});
