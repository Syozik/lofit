import {
    changePassword,
    deleteUser,
    useDisplayCurrency,
    useRecurring,
    useRecurringBuys,
    useRemoveRecurring,
    useRemoveRecurringBuy,
    useUpdateRecurring,
    useUpdateRecurringBuy,
    useUpdateSettings,
} from "@lofit/api";
import { cadenceLabel, euros, formatAmount, withSymbol } from "@lofit/domain";
import type { Recurring, RecurringBuy } from "@lofit/domain";
import { dayFormat, parsePositive } from "@lofit/view";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { ReactNode } from "react";
import { Pause, Pencil, Play, Repeat, Trash2, TrendingUp } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useOnline } from "../connectivity";
import { useGuest } from "../mode";
import { forgetCache } from "../queryClient";
import { forgetSignIn } from "../signedIn";
import type { Colors, ThemePreference } from "../theme";
import { fonts, radius, setThemePreference, space, useStyles, useTheme, useThemePreference } from "../theme";
import { AppUpdate } from "./AppUpdate";
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

function nextLabel(item: { paused: boolean; nextDue: string }): string {
    return item.paused ? "Paused" : `Next ${dayFormat.format(new Date(`${item.nextDue}T00:00:00Z`))}`;
}

function units(quantity: number): string {
    return `${quantity} ${quantity === 1 ? "unit" : "units"}`;
}

type RowProps = {
    icon: ReactNode;
    title: string;
    detail: string;
    value: string;
    gain?: boolean;
    paused: boolean;
    sizeLabel: string;
    initialSize: string;
    busy: boolean;
    failure: Error | null;
    onPause: () => void;
    onDelete: () => void;
    onSaveSize: (size: number, done: () => void) => void;
    first: boolean;
};

function RecurringRow(props: RowProps) {
    const styles = useStyles(makeStyles);
    const { colors } = useTheme();
    const [size, setSize] = useState<string | null>(null);
    const typed = size === null ? undefined : parsePositive(size);

    function save() {
        if (typed) props.onSaveSize(typed, () => setSize(null));
    }

    return (
        <View style={[styles.item, !props.first && styles.itemDivided]}>
            <View style={styles.itemRow}>
                <View style={[styles.itemMain, props.paused && styles.paused]}>
                    <View style={styles.badge}>{props.icon}</View>
                    <View style={styles.settingText}>
                        <Text style={styles.itemName}>{props.title}</Text>
                        <Text style={styles.settingHint}>{props.detail}</Text>
                    </View>
                    <Text style={[styles.itemValue, props.gain && { color: colors.gain }]}>{props.value}</Text>
                </View>
                {size === null && (
                    <View style={styles.actions}>
                        <IconAction label={`Edit ${props.sizeLabel.toLowerCase()}`} onPress={() => setSize(props.initialSize)}>
                            <Pencil size={15} strokeWidth={1.75} color={colors.quiet} />
                        </IconAction>
                        <IconAction label={props.paused ? "Resume" : "Pause"} disabled={props.busy} onPress={props.onPause}>
                            {props.paused ? <Play size={15} strokeWidth={1.75} color={colors.quiet} /> : <Pause size={15} strokeWidth={1.75} color={colors.quiet} />}
                        </IconAction>
                        <IconAction label="Delete" disabled={props.busy} onPress={props.onDelete}>
                            <Trash2 size={15} strokeWidth={1.75} color={colors.danger} />
                        </IconAction>
                    </View>
                )}
            </View>
            {size !== null && (
                <View style={styles.editor}>
                    <Field
                        label={props.sizeLabel}
                        value={size}
                        onChangeText={setSize}
                        keyboardType="decimal-pad"
                        autoFocus
                        onSubmitEditing={save}
                    />
                    <View style={styles.row}>
                        <Button variant="secondary" label="Cancel" onPress={() => setSize(null)} style={{ flex: 1 }} />
                        <Button label="Save" disabled={!typed || props.busy} onPress={save} style={{ flex: 1 }} />
                    </View>
                </View>
            )}
            {props.failure && <Text style={styles.error}>{props.failure.message}</Text>}
        </View>
    );
}

function IconAction({
    label,
    onPress,
    disabled,
    children,
}: {
    label: string;
    onPress: () => void;
    disabled?: boolean;
    children: ReactNode;
}) {
    const styles = useStyles(makeStyles);
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={label}
            disabled={disabled}
            onPress={onPress}
            hitSlop={6}
            style={({ pressed }) => [styles.iconAction, (pressed || disabled) && styles.dim]}
        >
            {children}
        </Pressable>
    );
}

function RecurringItem({ item, first }: { item: Recurring; first: boolean }) {
    const { colors } = useTheme();
    const update = useUpdateRecurring();
    const remove = useRemoveRecurring();
    const income = item.amount > 0;

    return (
        <RecurringRow
            first={first}
            icon={<Repeat size={15} strokeWidth={1.75} color={colors.accent} />}
            title={item.name}
            detail={`${cadenceLabel(item)} · ${nextLabel(item)}`}
            value={`${income ? "+" : "−"}${withSymbol(formatAmount(item.amount), item.currency)}`}
            gain={income}
            paused={item.paused}
            sizeLabel="Amount"
            initialSize={(Math.abs(item.amount) / 100).toFixed(2)}
            busy={update.isPending || remove.isPending}
            failure={update.error ?? remove.error}
            onPause={() => update.mutate({ id: item.id, patch: { paused: !item.paused } })}
            onDelete={() => remove.mutate(item.id)}
            onSaveSize={(size, done) => {
                const amount = income ? euros(size) : euros(-size);
                update.mutate({ id: item.id, patch: { amount } }, { onSuccess: done });
            }}
        />
    );
}

function RecurringBuyItem({ item, first }: { item: RecurringBuy; first: boolean }) {
    const { colors } = useTheme();
    const update = useUpdateRecurringBuy();
    const remove = useRemoveRecurringBuy();
    const byAmount = item.amount !== undefined;

    return (
        <RecurringRow
            first={first}
            icon={<TrendingUp size={15} strokeWidth={1.75} color={colors.accent} />}
            title={`Buy ${item.symbol}`}
            detail={`${cadenceLabel(item)} · ${nextLabel(item)}`}
            value={byAmount ? withSymbol(formatAmount(item.amount!), item.currency) : units(item.quantity ?? 0)}
            paused={item.paused}
            sizeLabel={byAmount ? "Amount" : "Units"}
            initialSize={byAmount ? (item.amount! / 100).toFixed(2) : String(item.quantity ?? "")}
            busy={update.isPending || remove.isPending}
            failure={update.error ?? remove.error}
            onPause={() => update.mutate({ id: item.id, patch: { paused: !item.paused } })}
            onDelete={() => remove.mutate(item.id)}
            onSaveSize={(size, done) => {
                const patch = byAmount ? { amount: euros(size) } : { quantity: size };
                update.mutate({ id: item.id, patch }, { onSuccess: done });
            }}
        />
    );
}

function RecurringList() {
    const styles = useStyles(makeStyles);
    const items = useRecurring().data ?? [];
    const buys = useRecurringBuys().data ?? [];
    if (items.length === 0 && buys.length === 0) return null;

    return (
        <View style={[styles.divided, styles.section]}>
            <View style={styles.settingText}>
                <Text style={styles.settingName}>Recurring</Text>
                <Text style={styles.settingHint}>These log themselves on their due date.</Text>
            </View>
            <View style={styles.card}>
                {items.map((item, index) => (
                    <RecurringItem key={item.id} item={item} first={index === 0} />
                ))}
                {buys.map((item, index) => (
                    <RecurringBuyItem key={item.id} item={item} first={items.length === 0 && index === 0} />
                ))}
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

            <RecurringList />

            <View style={styles.divided}>
                <AppUpdate />
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
        section: { gap: space[3] },
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
        card: {
            backgroundColor: colors.surface,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.divider,
            borderRadius: radius.lg,
            overflow: "hidden",
        },
        item: { paddingLeft: space[4], paddingRight: space[2], paddingVertical: space[3], gap: space[2] },
        itemDivided: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline },
        itemRow: { flexDirection: "row", alignItems: "center", gap: space[2] },
        itemMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: space[3] },
        paused: { opacity: 0.55 },
        badge: {
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: colors.accentFill,
            alignItems: "center",
            justifyContent: "center",
        },
        itemName: { fontFamily: fonts.medium, fontSize: 14, color: colors.text },
        itemValue: { fontFamily: fonts.medium, fontSize: 14, color: colors.text, fontVariant: ["tabular-nums"] },
        actions: { flexDirection: "row" },
        iconAction: { width: 30, height: 30, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
        dim: { opacity: 0.5 },
        editor: { gap: space[3], paddingTop: space[2], paddingBottom: space[2] },
        settingRow: { flexDirection: "row", alignItems: "center", gap: space[4] },
        settingText: { flex: 1, gap: 2 },
        settingName: { fontFamily: fonts.regular, fontSize: 14, color: colors.text },
        settingHint: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
    });
