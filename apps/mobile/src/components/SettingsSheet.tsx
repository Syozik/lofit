import { changePassword, deleteUser, useDisplayCurrency, useUpdateSettings } from "@lofit/api";
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
        settingRow: { flexDirection: "row", alignItems: "center", gap: space[4], marginBottom: space[8] },
        settingText: { flex: 1, gap: 2 },
        settingName: { fontFamily: fonts.regular, fontSize: 14, color: colors.text },
        settingHint: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
    });
