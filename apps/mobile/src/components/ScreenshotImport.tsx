import { isUnreachable, useAddTransaction } from "@lofit/api";
import type { Screenshot, useImportScreenshot } from "@lofit/api";
import { euros } from "@lofit/domain";
import type { Account, ImportDraft, ScreenshotImport, Tag } from "@lofit/domain";
import { dayFormat, parsePositive } from "@lofit/view";
import * as ImagePicker from "expo-image-picker";
import { Square, SquareCheck, TriangleAlert } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { toInstant } from "../days";
import { colors, fonts, radius, space } from "../theme";
import { Button } from "./Button";
import { Chip, ChipRow } from "./Choices";
import { fieldStyles } from "./Field";
import { pickDay } from "./RangePicker";
import { SheetActions } from "./Sheet";
import { useToast } from "./Toast";

const MAX_BASE64 = 4_500_000;

const SIGNATURES: [string, Screenshot["mediaType"]][] = [
    ["iVBOR", "image/png"],
    ["/9j/", "image/jpeg"],
    ["UklGR", "image/webp"],
    ["R0lGO", "image/gif"],
];

export type Picked = { screenshot: Screenshot } | { tooLarge: true } | null;

export async function pickScreenshot(): Promise<Picked> {
    const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        base64: true,
        quality: 0.7,
    });
    const image = result.canceled ? undefined : result.assets[0]?.base64;
    if (!image) return null;
    if (image.length > MAX_BASE64) return { tooLarge: true };

    const mediaType = SIGNATURES.find(([prefix]) => image.startsWith(prefix))?.[1] ?? "image/jpeg";
    return { screenshot: { image, mediaType } };
}

type Reading = ReturnType<typeof useImportScreenshot>;

type Props = {
    reading: Reading;
    accounts: readonly Account[];
    tags: readonly Tag[];
    defaultAccountId: string;
    onBack: () => void;
    onRetry: () => void;
    onClose: () => void;
};

export function ScreenshotImportView({ reading, accounts, tags, defaultAccountId, onBack, onRetry, onClose }: Props) {
    if (reading.isPending) {
        return (
            <>
                <View style={styles.status}>
                    <ActivityIndicator color={colors.accent} />
                    <Text style={styles.statusText}>Reading screenshot…</Text>
                </View>
                <SheetActions>
                    <Button variant="secondary" label="Cancel" onPress={onBack} style={{ flex: 1 }} />
                </SheetActions>
            </>
        );
    }

    if (reading.isError) {
        return (
            <>
                <View style={styles.status}>
                    <TriangleAlert size={22} color={colors.danger} />
                    <Text style={styles.statusText}>
                        {isUnreachable(reading.error) ? "Screenshot import needs a connection" : reading.error.message}
                    </Text>
                </View>
                <SheetActions>
                    <Button variant="secondary" label="Back" onPress={onBack} style={{ flex: 1 }} />
                    <Button label="Try again" onPress={onRetry} style={{ flex: 2 }} />
                </SheetActions>
            </>
        );
    }

    if (!reading.data) return null;

    if (reading.data.drafts.length === 0) {
        return (
            <>
                <View style={styles.status}>
                    <Text style={styles.statusTitle}>Nothing new found</Text>
                    {reading.data.skipped > 0 && (
                        <Text style={styles.statusText}>{skippedText(reading.data.skipped)}</Text>
                    )}
                </View>
                <SheetActions>
                    <Button variant="secondary" label="Close" onPress={onClose} style={{ flex: 1 }} />
                </SheetActions>
            </>
        );
    }

    return (
        <Review
            result={reading.data}
            accounts={accounts}
            tags={tags}
            defaultAccountId={defaultAccountId}
            onClose={onClose}
        />
    );
}

function skippedText(skipped: number): string {
    return `Skipped ${skipped} already logged`;
}

function entries(count: number): string {
    return count === 1 ? "1 entry" : `${count} entries`;
}

type Row = {
    checked: boolean;
    name: string;
    amount: string;
    kind: ImportDraft["kind"];
    day: string;
    accountId: string;
    tagId: string | undefined;
    currency: string | undefined;
};

function toRow(draft: ImportDraft, accounts: readonly Account[], tags: readonly Tag[], defaultAccountId: string): Row {
    const known = accounts.some((account) => account.id === draft.accountId);
    return {
        checked: draft.currency === undefined,
        name: draft.name,
        amount: (Math.abs(draft.amount) / 100).toFixed(2),
        kind: draft.kind,
        day: draft.day,
        accountId: known && draft.accountId ? draft.accountId : defaultAccountId,
        tagId: draft.tagIds.find((id) => tags.some((tag) => tag.id === id)),
        currency: draft.currency,
    };
}

function Review({
    result,
    accounts,
    tags,
    defaultAccountId,
    onClose,
}: {
    result: ScreenshotImport;
    accounts: readonly Account[];
    tags: readonly Tag[];
    defaultAccountId: string;
    onClose: () => void;
}) {
    const addEntry = useAddTransaction();
    const show = useToast();
    const [rows, setRows] = useState(() => result.drafts.map((draft) => toRow(draft, accounts, tags, defaultAccountId)));

    const chosen = rows.filter((row) => row.checked);
    const ready = chosen.every((row) => parsePositive(row.amount) && row.name.trim() && row.accountId);

    function change(index: number, patch: Partial<Row>) {
        setRows((current) => current.map((row, at) => (at === index ? { ...row, ...patch } : row)));
    }

    function save() {
        if (chosen.length === 0 || !ready) return;
        for (const row of chosen) {
            const value = parsePositive(row.amount) ?? 0;
            addEntry.mutate({
                name: row.name.trim(),
                kind: row.kind,
                tagIds: row.tagId ? [row.tagId] : [],
                accountId: row.accountId,
                amount: row.kind === "income" ? euros(value) : euros(-value),
                occurredAt: toInstant(row.day),
            });
        }
        show(`Added ${entries(chosen.length)}`);
        onClose();
    }

    return (
        <>
            <View style={styles.summary}>
                <Text style={styles.statusTitle}>Found {entries(result.drafts.length)}</Text>
                {result.skipped > 0 && <Text style={styles.statusText}>{skippedText(result.skipped)}</Text>}
            </View>

            {rows.map((row, index) => (
                <View key={index} style={[styles.row, !row.checked && styles.unchecked]}>
                    <View style={styles.line}>
                        <Pressable
                            accessibilityRole="checkbox"
                            accessibilityState={{ checked: row.checked }}
                            accessibilityLabel={`Include ${row.name}`}
                            hitSlop={8}
                            onPress={() => change(index, { checked: !row.checked })}
                        >
                            {row.checked ? (
                                <SquareCheck size={22} color={colors.accent} />
                            ) : (
                                <Square size={22} color={colors.subtle} />
                            )}
                        </Pressable>
                        <TextInput
                            accessibilityLabel="Description"
                            style={[fieldStyles.input, styles.grow]}
                            value={row.name}
                            onChangeText={(name) => change(index, { name })}
                            autoComplete="off"
                            importantForAutofill="no"
                        />
                    </View>

                    <View style={styles.line}>
                        <Pressable
                            accessibilityLabel={`${row.kind === "income" ? "Income" : "Expense"}, tap to switch`}
                            hitSlop={6}
                            onPress={() => change(index, { kind: row.kind === "income" ? "expense" : "income" })}
                            style={styles.sign}
                        >
                            <Text style={[styles.signText, row.kind === "income" && styles.income]}>
                                {row.kind === "income" ? "+€" : "−€"}
                            </Text>
                        </Pressable>
                        <TextInput
                            accessibilityLabel="Amount"
                            style={[
                                fieldStyles.input,
                                styles.grow,
                                styles.amount,
                                !parsePositive(row.amount) && styles.invalid,
                            ]}
                            value={row.amount}
                            onChangeText={(amount) => change(index, { amount })}
                            keyboardType="numbers-and-punctuation"
                            autoComplete="off"
                            importantForAutofill="no"
                        />
                        <Pressable
                            style={[fieldStyles.input, styles.date]}
                            onPress={() => pickDay(row.day, (day) => change(index, { day }))}
                        >
                            <Text style={styles.dateText}>{dayFormat.format(new Date(`${row.day}T00:00:00Z`))}</Text>
                        </Pressable>
                    </View>

                    {row.currency && (
                        <View style={styles.warning}>
                            <TriangleAlert size={13} color={colors.danger} />
                            <Text style={styles.warningText}>{row.currency} — check amount</Text>
                        </View>
                    )}

                    <ChipRow scroll>
                        {accounts.map((account) => (
                            <Chip
                                key={account.id}
                                label={account.name}
                                selected={row.accountId === account.id}
                                onPress={() => change(index, { accountId: account.id })}
                            />
                        ))}
                    </ChipRow>

                    <ChipRow scroll>
                        {tags.map((tag) => (
                            <Chip
                                key={tag.id}
                                label={tag.name}
                                selected={row.tagId === tag.id}
                                onPress={() => change(index, { tagId: row.tagId === tag.id ? undefined : tag.id })}
                            />
                        ))}
                    </ChipRow>
                </View>
            ))}

            <SheetActions>
                <Button variant="secondary" label="Cancel" onPress={onClose} style={{ flex: 1 }} />
                <Button
                    label={chosen.length === 0 ? "Nothing selected" : `Add ${entries(chosen.length)}`}
                    disabled={chosen.length === 0 || !ready || addEntry.isPending}
                    onPress={save}
                    style={{ flex: 2 }}
                />
            </SheetActions>
        </>
    );
}

const styles = StyleSheet.create({
    status: { alignItems: "center", gap: space[4], paddingVertical: space[8] },
    statusTitle: { fontFamily: fonts.medium, fontSize: 15, color: colors.text },
    statusText: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, textAlign: "center" },
    summary: { gap: 2 },
    row: {
        gap: space[3],
        paddingBottom: space[6],
        borderBottomWidth: 1,
        borderBottomColor: colors.hairline,
    },
    unchecked: { opacity: 0.55 },
    line: { flexDirection: "row", alignItems: "center", gap: space[3] },
    grow: { flex: 1 },
    amount: { textAlign: "right", fontVariant: ["tabular-nums"] },
    invalid: { borderColor: colors.danger },
    sign: { minWidth: 30, alignItems: "center" },
    signText: { fontFamily: fonts.medium, fontSize: 15, color: colors.quiet },
    income: { color: colors.accent },
    date: { justifyContent: "center" },
    dateText: { fontFamily: fonts.regular, fontSize: 14, color: colors.text },
    warning: {
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "flex-start",
        gap: 5,
        paddingVertical: 3,
        paddingHorizontal: 8,
        borderRadius: radius.sm,
        backgroundColor: "rgba(209, 69, 59, 0.1)",
    },
    warningText: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.danger },
});
