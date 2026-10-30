import {
    changePassword,
    deleteUser,
    useDisplayCurrency,
    useRecurring,
    useRemoveRecurring,
    useUpdateRecurring,
    useUpdateSettings,
} from "@lofit/api";
import { cadenceLabel, euros, formatAmount, withSymbol } from "@lofit/domain";
import type { Recurring } from "@lofit/domain";
import { dayFormat, parsePositive } from "@lofit/view";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useOnline } from "../connectivity";
import { useGuest } from "../mode";
import { forgetCache } from "../queryClient";
import { forgetSignIn } from "../signedIn";
import type { Colors, ThemePreference } from "../theme";
import { fonts, setThemePreference, space, useStyles, useThemePreference } from "../theme";
import { Button } from "./Button";
import { Segmented } from "./Choices";
import { CurrencyPicker } from "./CurrencyPicker";
import { Field } from "./Field";
import { Sheet } from "./Sheet";
import { useToast } from "./Toast";

const MIN_PASSWORD = 8;

const THEMES: { value: ThemePreference; label: string }[] = [
    { value: "system", label: "System" },
    { value: "light", label: "Light" },
    { value: "dark", label: "Dark" },
];

function PasswordForm() {
    const styles = useStyles(makeStyles);
    const show = useToast();
    const [open, setOpen] = useState(false);
    const [current, setCurrent] = useState("");
    const [next, setNext] = useState("");
    const [pending, setPending] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const short = next.length > 0 && next.length < MIN_PASSWORD;
    const blocked = pending || !current || next.length < MIN_PASSWORD;

    async function save() {
        if (blocked) return;
        setPending(true);
        setError(null);
        try {
            await changePassword(current, next);
            close();
            show("Password changed");
        } catch (failure) {
            setError(failure instanceof Error ? failure.message : "Something went wrong.");
        } finally {
            setPending(false);
        }
    }

    function close() {
        setOpen(false);
        setCurrent("");
        setNext("");
        setError(null);
    }

    if (!open) {
        return (
            <View style={styles.settingRow}>
                <View style={styles.settingText}>
                    <Text style={styles.settingName}>Password</Text>
                    <Text style={styles.settingHint}>Used to sign in on the web and your phone.</Text>
                </View>
                <Button variant="secondary" label="Change" onPress={() => setOpen(true)} />
            </View>
        );
    }

    return (
        <View style={styles.section}>
            <Field
                label="Current password"
                autoFocus
                value={current}
                onChangeText={setCurrent}
                autoComplete="current-password"
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
            />
            <Field
                label="New password"
                value={next}
                onChangeText={setNext}
                autoComplete="new-password"
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                onSubmitEditing={() => void save()}
                hint={short ? `At least ${MIN_PASSWORD} characters.` : undefined}
            />
            {error && <Text style={styles.error}>{error}</Text>}
            <View style={styles.row}>
                <Button variant="secondary" label="Cancel" onPress={close} style={{ flex: 1 }} />
                <Button
                    label={pending ? "One moment…" : "Save password"}
                    disabled={blocked}
                    onPress={() => void save()}
                    style={{ flex: 1 }}
                />
            </View>
        </View>
    );
}

function RecurringItem({ item }: { item: Recurring }) {
    const styles = useStyles(makeStyles);
    const update = useUpdateRecurring();
    const remove = useRemoveRecurring();
    const [amount, setAmount] = useState<string | null>(null);
    const typed = amount === null ? undefined : parsePositive(amount);
    const failure = update.error ?? remove.error;

    function saveAmount() {
        if (!typed) return;
        const signed = item.kind === "income" ? euros(typed) : euros(-typed);
        update.mutate({ id: item.id, patch: { amount: signed } }, { onSuccess: () => setAmount(null) });
    }

    return (
        <View style={[styles.recurring, item.paused && styles.paused]}>
            <View style={styles.itemRow}>
                <View style={styles.settingText}>
                    <Text style={styles.settingName}>{item.name}</Text>
                    <Text style={styles.settingHint}>
                        {cadenceLabel(item)} ·{" "}
                        {item.paused ? "paused" : `next ${dayFormat.format(new Date(`${item.nextDue}T00:00:00Z`))}`}
                    </Text>
                </View>
                <Text style={styles.settingName}>
                    {item.amount > 0 ? "+" : "−"}
                    {withSymbol(formatAmount(item.amount), item.currency)}
                </Text>
            </View>
            {amount === null ? (
                <View style={styles.row}>
                    <Button
                        variant="ghost"
                        label="Edit amount"
                        onPress={() => setAmount((Math.abs(item.amount) / 100).toFixed(2))}
                    />
                    <Button
                        variant="ghost"
                        label={item.paused ? "Resume" : "Pause"}
                        disabled={update.isPending}
                        onPress={() => update.mutate({ id: item.id, patch: { paused: !item.paused } })}
                    />
                    <Button
                        variant="ghost"
                        label="Delete"
                        labelStyle={styles.danger}
                        disabled={remove.isPending}
                        onPress={() => remove.mutate(item.id)}
                    />
                </View>
            ) : (
                <View style={styles.section}>
                    <Field
                        label="Amount"
                        value={amount}
                        onChangeText={setAmount}
                        keyboardType="decimal-pad"
                        autoFocus
                        onSubmitEditing={saveAmount}
                    />
                    <View style={styles.row}>
                        <Button variant="secondary" label="Cancel" onPress={() => setAmount(null)} style={{ flex: 1 }} />
                        <Button
                            label="Save"
                            disabled={!typed || update.isPending}
                            onPress={saveAmount}
                            style={{ flex: 1 }}
                        />
                    </View>
                </View>
            )}
            {failure && <Text style={styles.error}>{failure.message}</Text>}
        </View>
    );
}

function RecurringList() {
    const styles = useStyles(makeStyles);
    const items = useRecurring().data ?? [];

    return (
        <View style={styles.section}>
            <View style={styles.settingText}>
                <Text style={styles.settingName}>Recurring</Text>
                <Text style={styles.settingHint}>
                    {items.length === 0
                        ? "Pick “Repeats” when logging an entry and it logs itself from then on."
                        : "These log themselves on their due date."}
                </Text>
            </View>
            {items.map((item) => (
                <RecurringItem key={item.id} item={item} />
            ))}
        </View>
    );
}

function DeleteAccount() {
    const styles = useStyles(makeStyles);
    const client = useQueryClient();
    const online = useOnline();
    const [confirming, setConfirming] = useState(false);
    const [password, setPassword] = useState("");
    const [pending, setPending] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function remove() {
        if (pending || !password) return;
        setPending(true);
        setError(null);
        try {
            await deleteUser(password);
            await forgetSignIn();
            await forgetCache(client, "account");
        } catch (failure) {
            setError(failure instanceof Error ? failure.message : "Something went wrong.");
            setPending(false);
        }
    }

    if (!confirming) {
        return <Button variant="secondary" label="Delete account" labelStyle={styles.danger} onPress={() => setConfirming(true)} />;
    }

    return (
        <View style={styles.section}>
            <Text style={styles.warning}>
                This deletes your account and everything in it. It can't be undone.
            </Text>
            <Field
                label="Password"
                value={password}
                onChangeText={setPassword}
                autoComplete="current-password"
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
            />
            {!online && <Text style={styles.error}>Deleting your account needs a connection.</Text>}
            {error && <Text style={styles.error}>{error}</Text>}
            <View style={styles.row}>
                <Button variant="secondary" label="Cancel" onPress={() => setConfirming(false)} style={{ flex: 1 }} />
                <Button
                    variant="danger"
                    label={pending ? "Deleting…" : "Delete forever"}
                    disabled={pending || !password || !online}
                    onPress={() => void remove()}
                    style={{ flex: 1 }}
                />
            </View>
        </View>
    );
}

export function SettingsSheet({ onClose }: { onClose: () => void }) {
    const styles = useStyles(makeStyles);
    const guest = useGuest();
    const show = useToast();
    const theme = useThemePreference();
    const currency = useDisplayCurrency();
    const updateSettings = useUpdateSettings();

    return (
        <Sheet title="Settings" onClose={onClose}>
            <View style={styles.section}>
                <Text style={styles.label}>Theme</Text>
                <Segmented options={THEMES} value={theme} onChange={(next) => void setThemePreference(next)} />
            </View>

            <View style={styles.section}>
                <CurrencyPicker
                    value={currency}
                    onChange={(chosen) => {
                        if (chosen === currency || updateSettings.isPending) return;
                        updateSettings.mutate({ currency: chosen }, { onError: (error) => show(error.message) });
                    }}
                    hint={
                        guest
                            ? "Amounts keep previous numbers, holdings are re-priced in the new currency."
                            : "Totals convert to this currency. Each account keeps its own."
                    }
                />
            </View>

            <View style={styles.divided}>
                <RecurringList />
            </View>

            {!guest && (
                <>
                    <View style={styles.divided}>
                        <PasswordForm />
                    </View>
                    <View style={styles.divided}>
                        <DeleteAccount />
                    </View>
                </>
            )}
        </Sheet>
    );
}

const makeStyles = (colors: Colors) =>
    StyleSheet.create({
        section: { gap: space[4], marginBottom: space[8] },
        divided: {
            paddingTop: space[6],
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.divider,
        },
        label: { fontFamily: fonts.regular, fontSize: 12, color: colors.quiet },
        error: { fontFamily: fonts.regular, fontSize: 13, color: colors.danger },
        warning: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.quiet },
        danger: { color: colors.danger },
        row: { flexDirection: "row", gap: space[3] },
        recurring: {
            gap: space[2],
            padding: space[3],
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.divider,
            borderRadius: 8,
        },
        paused: { opacity: 0.6 },
        itemRow: { flexDirection: "row", alignItems: "center", gap: space[4] },
        settingRow: { flexDirection: "row", alignItems: "center", gap: space[4], marginBottom: space[8] },
        settingText: { flex: 1, gap: 2 },
        settingName: { fontFamily: fonts.regular, fontSize: 14, color: colors.text },
        settingHint: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
    });
