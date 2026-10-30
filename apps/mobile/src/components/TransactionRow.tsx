import { cents, formatAmount, withSymbol } from "@lofit/domain";
import type { Transaction } from "@lofit/domain";
import { amountFor, metaParts, monogram, transactionMeta } from "@lofit/view";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Colors } from "../theme";
import { fonts, radius, useStyles } from "../theme";
import { SwipeRow } from "./SwipeRow";

type Props = {
    transaction: Transaction;
    accountNames: ReadonlyMap<string, string>;
    tagNames: ReadonlyMap<string, string>;
    viewedFrom?: string;
    onPress?: (transaction: Transaction) => void;
    onEdit?: (transaction: Transaction) => void;
    onDelete?: (transaction: Transaction) => void;
    onTag?: (tagId: string) => void;
    selectedTags?: readonly string[];
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
    onTag,
    selectedTags = [],
    surface,
}: Props) {
    const styles = useStyles(makeStyles);
    const parts = onTag ? metaParts(transaction, accountNames, tagNames, viewedFrom) : undefined;
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
                    {parts && onTag ? (
                        <>
                            {parts.lead}
                            {" · "}
                            {parts.tags.length === 0
                                ? parts.kind
                                : parts.tags.map((tag, index) => (
                                      <Text key={tag.id}>
                                          {index > 0 && " · "}
                                          <Text
                                              accessibilityRole="button"
                                              accessibilityLabel={`Show only ${tag.name}`}
                                              suppressHighlighting
                                              onPress={() => onTag(tag.id)}
                                              style={[styles.tag, selectedTags.includes(tag.id) && styles.tagOn]}
                                          >
                                              {tag.name}
                                          </Text>
                                      </Text>
                                  ))}
                            {parts.where ? ` · ${parts.where}` : ""}
                        </>
                    ) : (
                        transactionMeta(transaction, accountNames, tagNames, viewedFrom)
                    )}
                </Text>
            </View>
            <Text style={[styles.amount, amount > 0 ? styles.positive : null]}>
                {amount > 0 ? "+" : "−"}
                {withSymbol(formatAmount(cents(amount)))}
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

const makeStyles = (colors: Colors) =>
    StyleSheet.create({
        row: {
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            paddingVertical: 11,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.divider,
        },
        pressed: { opacity: 0.6 },
        tag: { textDecorationLine: "underline", textDecorationStyle: "dotted" },
        tagOn: { color: colors.accent },
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
