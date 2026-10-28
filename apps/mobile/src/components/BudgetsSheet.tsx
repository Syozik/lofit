import { useSetBudget } from "@lofit/api";
import { cents, euros, formatAmount, sumCents, tagsFor } from "@lofit/domain";
import type { Budget, Cents, Tag } from "@lofit/domain";
import { parsePositive } from "@lofit/view";
import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import type { Colors } from "../theme";
import { fonts, space, useStyles, useTheme } from "../theme";
import { Button } from "./Button";
import { makeFieldStyles } from "./Field";
import { Sheet, SheetActions } from "./Sheet";
import { useToast } from "./Toast";

type Props = {
    tags: readonly Tag[];
    budgets: readonly Budget[];
    spent: ReadonlyMap<string, Cents>;
    month: string;
    onClose: () => void;
};

type Draft = { value: string; limit: Cents | null; valid: boolean };

function readDraft(value: string): Draft {
    if (!value.trim()) return { value, limit: null, valid: true };
    const amount = parsePositive(value);
    return amount === undefined
        ? { value, limit: null, valid: false }
        : { value, limit: euros(amount), valid: true };
}

export function BudgetsSheet({ tags, budgets, spent, month, onClose }: Props) {
    const { colors } = useTheme();
    const styles = useStyles(makeStyles);
    const fieldStyles = useStyles(makeFieldStyles);
    const setBudget = useSetBudget();
    const show = useToast();
    const ordered = tagsFor(tags, "expense").sort((one, other) => one.position - other.position);
    const limits = new Map(budgets.map((budget) => [budget.tagId, budget.limit]));

    const [values, setValues] = useState<Record<string, string>>(() =>
        Object.fromEntries(
            ordered.map((tag) => {
                const limit = limits.get(tag.id);
                return [tag.id, limit === undefined ? "" : (limit / 100).toFixed(2)];
            }),
        ),
    );

    const drafts = new Map(ordered.map((tag) => [tag.id, readDraft(values[tag.id] ?? "")]));
    const valid = [...drafts.values()].every((draft) => draft.valid);
    const total = sumCents([...drafts.values()].map((draft) => draft.limit ?? cents(0)));

    function save() {
        if (!valid) return;
        for (const [tagId, draft] of drafts) {
            if (draft.limit !== (limits.get(tagId) ?? null)) setBudget.mutate({ tagId, limit: draft.limit });
        }
        show("Budgets saved");
        onClose();
    }

    return (
        <Sheet title="Budgets" note={`Spent in ${month}`} onClose={onClose}>
            <View style={styles.rows}>
                {ordered.map((tag) => {
                    const draft = drafts.get(tag.id);
                    return (
                        <View key={tag.id} style={styles.row}>
                            <View style={styles.label}>
                                <Text style={styles.name} numberOfLines={1}>
                                    {tag.name}
                                </Text>
                                <Text style={styles.spent}>€ {formatAmount(spent.get(tag.id) ?? cents(0))} spent</Text>
                            </View>
                            <View style={styles.inputWrap}>
                                <Text style={styles.currency}>€</Text>
                                <TextInput
                                    accessibilityLabel={`${tag.name} budget`}
                                    style={[fieldStyles.input, styles.input, draft?.valid === false && styles.invalid]}
                                    value={values[tag.id] ?? ""}
                                    onChangeText={(value) => setValues((current) => ({ ...current, [tag.id]: value }))}
                                    placeholder="No budget"
                                    placeholderTextColor={colors.subtle}
                                    keyboardType="numbers-and-punctuation"
                                    autoComplete="off"
                                    importantForAutofill="no"
                                />
                            </View>
                        </View>
                    );
                })}
            </View>

            <Text style={styles.total}>€ {formatAmount(total)} a month</Text>

            <SheetActions>
                <Button variant="secondary" label="Cancel" onPress={onClose} style={{ flex: 1 }} />
                <Button label="Save" disabled={!valid} onPress={save} style={{ flex: 2 }} />
            </SheetActions>
        </Sheet>
    );
}

const makeStyles = (colors: Colors) =>
    StyleSheet.create({
        rows: { gap: space[4] },
        row: { flexDirection: "row", alignItems: "center", gap: space[6] },
        label: { flex: 1, gap: 2 },
        name: { fontFamily: fonts.medium, fontSize: 14, color: colors.text },
        spent: { fontFamily: fonts.regular, fontSize: 11.5, color: colors.muted, fontVariant: ["tabular-nums"] },
        inputWrap: { flexDirection: "row", alignItems: "center", gap: 6 },
        currency: { fontFamily: fonts.medium, fontSize: 14, color: colors.subtle },
        input: { width: 120, textAlign: "right", fontVariant: ["tabular-nums"] },
        invalid: { borderColor: colors.danger },
        total: { fontFamily: fonts.medium, fontSize: 14, color: colors.text, textAlign: "right", fontVariant: ["tabular-nums"] },
    });
