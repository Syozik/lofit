import {
    useAccounts,
    useAddHolding,
    useAddTag,
    useAddTransaction,
    useGroups,
    useImportScreenshot,
    useRenameTag,
    useTags,
    useUpdateTransaction,
} from "@lofit/api";
import type { Screenshot } from "@lofit/api";
import { ASSET_TYPE_LABELS, ASSET_TYPES, CURRENCIES, euros, investingGroups, KIND_LABELS, tagsFor } from "@lofit/domain";
import type {
    Account,
    AssetType,
    Currency,
    ImportDraft,
    NewHolding,
    NewTransaction,
    QuoteRef,
    Transaction,
    TransactionKind,
} from "@lofit/domain";
import { currencyFormat, dayFormat, parsePositive } from "@lofit/view";
import { ImagePlus, TriangleAlert } from "lucide-react-native";
import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { Colors } from "../theme";
import { fonts, useStyles, useTheme } from "../theme";
import { AmountInput } from "./AmountInput";
import { Button } from "./Button";
import { Chip, ChipRow, Segmented } from "./Choices";
import { Field, makeFieldStyles } from "./Field";
import { pickDay } from "./RangePicker";
import { pickFile, ScreenshotImportView, skippedText } from "./ScreenshotImport";
import { Sheet, SheetActions } from "./Sheet";
import { useOnline } from "../connectivity";
import { today, toInstant } from "../days";
import { useToast } from "./Toast";

type EntryMode = TransactionKind | "holding";

const MODE_LABELS: Record<EntryMode, string> = { ...KIND_LABELS, holding: "Holding" };

const ALL_MODES = (["expense", "income", "transfer", "holding"] as const).map((value) => ({
    value,
    label: MODE_LABELS[value],
}));

const TRANSACTION_MODES = ALL_MODES.filter((option) => option.value !== "holding");

const CURRENCY_SYMBOLS: Record<Currency, string> = { EUR: "€", USD: "$" };

const DOUBLE_TAP_MS = 350;

function AccountPicker({
    label,
    accounts,
    value,
    onChange,
}: {
    label: string;
    accounts: readonly Account[];
    value: string;
    onChange: (id: string) => void;
}) {
    const styles = useStyles(makeStyles);
    return (
        <View style={styles.field}>
            <Text style={styles.label}>{label}</Text>
            <ChipRow scroll>
                {accounts.map((account) => (
                    <Chip
                        key={account.id}
                        label={account.name}
                        selected={value === account.id}
                        onPress={() => onChange(account.id)}
                    />
                ))}
            </ChipRow>
        </View>
    );
}

function DateField({ label, day, onChange, max }: { label: string; day: string; onChange: (day: string) => void; max?: string }) {
    const styles = useStyles(makeStyles);
    const fieldStyles = useStyles(makeFieldStyles);
    return (
        <View style={styles.field}>
            <Text style={styles.label}>{label}</Text>
            <Pressable
                style={[fieldStyles.input, styles.date]}
                onPress={() => pickDay(day, onChange, max ? { max } : {})}
            >
                <Text style={styles.dateText}>{dayFormat.format(new Date(`${day}T00:00:00Z`))}</Text>
            </Pressable>
        </View>
    );
}

type Queue = {
    drafts: readonly ImportDraft[];
    skipped: number;
    statement: boolean;
    at: number;
    saved: number;
};

function entries(count: number): string {
    return count === 1 ? "1 entry" : `${count} entries`;
}

type Props = {
    entry?: Transaction | undefined;
    onClose: () => void;
};

export function EntrySheet({ entry, onClose }: Props) {
    const { colors } = useTheme();
    const styles = useStyles(makeStyles);
    const fieldStyles = useStyles(makeFieldStyles);
    const { data: accounts } = useAccounts();
    const { data: groups } = useGroups();
    const { data: tags } = useTags();
    const addEntry = useAddTransaction();
    const addPosition = useAddHolding();
    const addNewTag = useAddTag();
    const rename = useRenameTag();
    const updateEntry = useUpdateTransaction();
    const show = useToast();
    const online = useOnline();
    const reading = useImportScreenshot();
    const [shot, setShot] = useState<Screenshot | null>(null);
    const [queue, setQueue] = useState<Queue | null>(null);

    const [mode, setMode] = useState<EntryMode>(entry?.kind ?? "expense");
    const [amount, setAmount] = useState(entry ? (Math.abs(entry.amount) / 100).toFixed(2) : "");
    const [name, setName] = useState(entry?.name ?? "");
    const [tagIds, setTagIds] = useState<string[]>([...(entry?.tagIds ?? [])]);
    const [newTag, setNewTag] = useState<string | undefined>(undefined);
    const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
    const lastTap = useRef<{ id: string; at: number } | null>(null);
    const [day, setDay] = useState(entry ? entry.occurredAt.slice(0, 10) : today());
    const [fromId, setFromId] = useState(entry?.accountId ?? "");
    const [toId, setToId] = useState(entry?.toAccountId ?? "");

    const [symbol, setSymbol] = useState("");
    const [assetType, setAssetType] = useState<AssetType>("stock");
    const [custodianId, setCustodianId] = useState("");
    const [quantity, setQuantity] = useState("");
    const [currency, setCurrency] = useState<Currency>("EUR");
    const [liveSymbol, setLiveSymbol] = useState("");
    const [ownTicker, setOwnTicker] = useState(false);

    const editing = entry !== undefined;
    const isHolding = mode === "holding";
    const allAccounts = accounts ?? [];

    const mirrored = assetType === "crypto" ? "" : symbol.trim().toUpperCase();
    const ticker = ownTicker ? liveSymbol : mirrored;

    const investing = new Set(investingGroups(groups ?? []).map((group) => group.id));
    const brokerages = allAccounts.filter((account) => investing.has(account.groupId));

    const from = fromId || allAccounts[0]?.id || "";
    const heldAt = custodianId || brokerages[0]?.id || "";
    const to = toId || allAccounts.find((account) => account.id !== from)?.id || "";

    const fitting = isHolding ? [] : tagsFor(tags ?? [], mode);
    const chosenIds = tags || mode === "transfer" ? tagIds.filter((id) => fitting.some((tag) => tag.id === id)) : tagIds;

    const value = parsePositive(amount);
    const units = parsePositive(quantity);

    const blocked = isHolding
        ? !value || !units || !symbol.trim() || !heldAt || !day
        : !value || !name.trim() || !from || (mode === "transfer" && (!to || to === from));

    const pending = (!queue && addEntry.isPending) || addPosition.isPending || updateEntry.isPending;
    const needsConnection = isHolding && !online;

    function nextCurrency() {
        const at = CURRENCIES.indexOf(currency);
        setCurrency(CURRENCIES[(at + 1) % CURRENCIES.length]!);
    }

    function changeMode(next: EntryMode) {
        setMode(next);
        if (next === "holding" || !tags) return;
        const fits = tagsFor(tags, next);
        setTagIds((chosen) => chosen.filter((id) => fits.some((tag) => tag.id === id)));
    }

    function toggleTag(id: string) {
        setTagIds((chosen) => (chosen.includes(id) ? chosen.filter((other) => other !== id) : [...chosen, id]));
    }

    function tapTag(id: string, tagName: string, now: number) {
        toggleTag(id);
        if (lastTap.current?.id === id && now - lastTap.current.at < DOUBLE_TAP_MS) {
            lastTap.current = null;
            setRenaming({ id, name: tagName });
        } else {
            lastTap.current = { id, at: now };
        }
    }

    function finishRename() {
        if (!renaming) return;
        const wanted = renaming.name.trim();
        const original = (tags ?? []).find((tag) => tag.id === renaming.id)?.name;
        setRenaming(null);
        if (!wanted || wanted === original) return;

        rename.mutate({ id: renaming.id, name: wanted });
    }

    async function createTag() {
        const wanted = newTag?.trim();
        setNewTag(undefined);
        if (!wanted || (mode !== "expense" && mode !== "income")) return;

        const tag = await addNewTag.mutateAsync({ name: wanted, kind: mode });
        setTagIds((chosen) => (chosen.includes(tag.id) ? chosen : [...chosen, tag.id]));
    }

    function quoteFor(): QuoteRef | undefined {
        const wanted = ticker.trim();
        if (!wanted) return undefined;
        return assetType === "crypto"
            ? { source: "coingecko", id: wanted.toLowerCase() }
            : { source: "yahoo", symbol: wanted.toUpperCase() };
    }

    function saveHolding(price: number, count: number) {
        const shown = symbol.trim().toUpperCase();
        const quote = quoteFor();
        const holding: NewHolding = {
            symbol: shown,
            name: name.trim() || shown,
            type: assetType,
            accountId: heldAt,
            quantity: count,
            price: euros(price),
            currency,
            ...(quote ? { quote } : {}),
            heldSince: day,
            pricedAt: new Date().toISOString(),
        };

        addPosition.mutate(holding, {
            onSuccess: () => {
                show(`Added ${ticker || shown}`);
                onClose();
            },
        });
    }

    function saveTransaction(input: number) {
        const signed = mode === "income" ? euros(input) : euros(-input);
        const transaction: NewTransaction = {
            name: name.trim(),
            kind: mode as TransactionKind,
            tagIds: chosenIds,
            accountId: from,
            amount: signed,
            occurredAt: toInstant(day),
            ...(mode === "transfer" ? { toAccountId: to } : {}),
        };

        if (entry) {
            updateEntry.mutate({ id: entry.id, draft: transaction });
            show(`Updated ${name.trim()}`);
        } else if (queue) {
            addEntry.mutate(transaction);
            advance(queue, queue.saved + 1);
            return;
        } else {
            addEntry.mutate(transaction);
            show(`Saved ${name.trim()}`);
        }
        onClose();
    }

    async function startImport() {
        try {
            const picked = await pickFile();
            if (!picked) return;
            if ("unsupported" in picked) {
                show("Use a PNG, JPEG or PDF");
                return;
            }
            if ("tooLarge" in picked) {
                show("This file is too large");
                return;
            }
            read(picked.screenshot);
        } catch {
            show("Couldn't open that file");
        }
    }

    function read(screenshot: Screenshot) {
        setShot(screenshot);
        reading.mutate(screenshot, {
            onSuccess: (result) => {
                if (result.drafts.length === 0) return;
                const first = result.drafts[0]!;
                setQueue({
                    drafts: result.drafts,
                    skipped: result.skipped,
                    statement: screenshot.mediaType === "application/pdf",
                    at: 0,
                    saved: 0,
                });
                fill(first);
                setShot(null);
            },
        });
    }

    function fill(draft: ImportDraft) {
        const known = (id: string | undefined) => !!id && allAccounts.some((account) => account.id === id);
        const source = known(draft.accountId) ? draft.accountId! : from;
        setMode(draft.kind);
        setAmount((Math.abs(draft.amount) / 100).toFixed(2));
        setName(draft.name);
        setDay(draft.day);
        setFromId(source);
        setToId(known(draft.toAccountId) && draft.toAccountId !== source ? draft.toAccountId! : "");
        const fits = tagsFor(tags ?? [], draft.kind);
        setTagIds(draft.tagIds.filter((id) => fits.some((tag) => tag.id === id)));
        setNewTag(undefined);
        setRenaming(null);
    }

    function advance(current: Queue, saved: number) {
        const at = current.at + 1;
        const next = current.drafts[at];
        if (!next) {
            show(`Added ${saved} of ${entries(current.drafts.length)}`);
            onClose();
            return;
        }
        setQueue({ ...current, at, saved });
        fill(next);
    }

    function close() {
        if (queue && queue.saved > 0) show(`Added ${queue.saved} of ${entries(queue.drafts.length)}`);
        onClose();
    }

    function leaveImport() {
        reading.reset();
        setShot(null);
    }

    function save() {
        if (blocked || !value) return;
        if (isHolding) {
            if (units) saveHolding(value, units);
            return;
        }
        saveTransaction(value);
    }

    if (shot) {
        const statement = shot.mediaType === "application/pdf";
        return (
            <Sheet title={statement ? "From statement" : "From screenshot"} onClose={onClose}>
                <ScreenshotImportView
                    reading={reading}
                    statement={statement}
                    onBack={leaveImport}
                    onRetry={() => read(shot)}
                    onClose={onClose}
                />
            </Sheet>
        );
    }

    const draft = queue?.drafts[queue.at];

    return (
        <Sheet
            title={editing ? "Edit entry" : "Log an entry"}
            note={
                queue
                    ? [
                          `${queue.statement ? "From statement" : "From screenshot"} · ${queue.at + 1} of ${queue.drafts.length}`,
                          ...(queue.at === 0 && queue.skipped > 0 ? [skippedText(queue.skipped)] : []),
                      ].join(" · ")
                    : isHolding
                      ? "Manual · price per unit"
                      : "Manual"
            }
            action={queue ? { label: "Skip", onPress: () => advance(queue, queue.saved) } : undefined}
            onClose={close}
        >
            <View style={styles.modeRow}>
                <Segmented
                    options={editing || queue ? TRANSACTION_MODES : ALL_MODES}
                    value={mode}
                    onChange={changeMode}
                />
                {!editing && !queue && (
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="From screenshot or statement"
                        hitSlop={8}
                        onPress={() => void startImport()}
                        style={styles.screenshot}
                    >
                        <ImagePlus size={18} color={colors.accent} />
                    </Pressable>
                )}
            </View>

            <View style={styles.amountRow}>
                {isHolding && (
                    <Pressable
                        accessibilityLabel={`Priced in ${currency}, tap to change`}
                        onPress={nextCurrency}
                        style={styles.currencySwitch}
                    >
                        <Text style={styles.currencyText}>{CURRENCY_SYMBOLS[currency]}</Text>
                    </Pressable>
                )}
                <View style={styles.amountField}>
                    <AmountInput
                        label={isHolding ? "Price per unit" : "Amount"}
                        value={amount}
                        onChange={setAmount}
                        autoFocus={!editing}
                        prefix={isHolding ? "" : "€"}
                    />
                </View>
            </View>

            {draft?.currency && (
                <View style={styles.warning}>
                    <TriangleAlert size={13} color={colors.danger} />
                    <Text style={styles.warningText}>
                        Shown in {draft.currency} on the {queue?.statement ? "statement" : "screenshot"} — check the
                        amount
                    </Text>
                </View>
            )}

            {isHolding ? (
                <ChipRow>
                    {ASSET_TYPES.map((key) => (
                        <Chip
                            key={key}
                            label={ASSET_TYPE_LABELS[key]}
                            selected={assetType === key}
                            onPress={() => setAssetType(key)}
                        />
                    ))}
                </ChipRow>
            ) : mode === "transfer" ? null : (
                <ChipRow>
                    {fitting.map((tag) => {
                        const chosen = chosenIds.indexOf(tag.id);
                        if (renaming?.id === tag.id) {
                            return (
                                <TextInput
                                    key={tag.id}
                                    style={[fieldStyles.input, styles.inlineInput]}
                                    autoFocus
                                    selectTextOnFocus
                                    accessibilityLabel={`Rename ${tag.name}`}
                                    value={renaming.name}
                                    onChangeText={(text) => setRenaming({ id: tag.id, name: text })}
                                    onSubmitEditing={finishRename}
                                    onBlur={finishRename}
                                    autoComplete="off"
                                />
                            );
                        }
                        return (
                            <Chip
                                key={tag.id}
                                label={tag.name}
                                selected={chosen > 0}
                                strong={chosen === 0}
                                onPress={(event) => tapTag(tag.id, tag.name, event.nativeEvent.timestamp)}
                            />
                        );
                    })}
                    {newTag === undefined ? (
                        <Chip label="+ New tag" onPress={() => setNewTag("")} />
                    ) : (
                        <TextInput
                            style={[fieldStyles.input, styles.inlineInput]}
                            autoFocus
                            placeholder="New tag"
                            value={newTag}
                            onChangeText={setNewTag}
                            onSubmitEditing={() => void createTag()}
                            onBlur={() => void createTag()}
                            autoComplete="off"
                        />
                    )}
                </ChipRow>
            )}

            {isHolding ? (
                <>
                    <View style={styles.pair}>
                        <View style={styles.half}>
                            <Field
                                label="Symbol"
                                placeholder="VWRL"
                                autoCapitalize="characters"
                                autoCorrect={false}
                                value={symbol}
                                onChangeText={setSymbol}
                            />
                        </View>
                        <View style={styles.half}>
                            <Field
                                label="Quantity"
                                placeholder="10"
                                keyboardType="decimal-pad"
                                value={quantity}
                                onChangeText={setQuantity}
                            />
                        </View>
                    </View>
                    <Field label="Name" placeholder="Vanguard FTSE All-World" value={name} onChangeText={setName} />
                    <Field
                        label="Live price symbol"
                        placeholder={assetType === "crypto" ? "bitcoin" : "GOOGL"}
                        autoCapitalize={assetType === "crypto" ? "none" : "characters"}
                        autoCorrect={false}
                        value={ticker}
                        onChangeText={(text) => {
                            setOwnTicker(true);
                            setLiveSymbol(text);
                        }}
                        hint={
                            assetType === "crypto"
                                ? "CoinGecko id · empty keeps the price you typed"
                                : "NASDAQ and NYSE need no suffix · European listings do, e.g. VWRL.AS"
                        }
                    />
                    <AccountPicker label="Held at" accounts={brokerages} value={heldAt} onChange={setCustodianId} />
                    <DateField label="Bought on" day={day} onChange={setDay} max={today()} />
                    {value && units ? (
                        <Text style={styles.total}>
                            Position value {currencyFormat(currency).format(value * units)}
                        </Text>
                    ) : null}
                </>
            ) : (
                <>
                    <Field label="Description" placeholder="Albert Heijn" value={name} onChangeText={setName} />
                    <AccountPicker
                        label={mode === "transfer" ? "From" : "Account"}
                        accounts={allAccounts}
                        value={from}
                        onChange={setFromId}
                    />
                    {mode === "transfer" && (
                        <AccountPicker
                            label="To"
                            accounts={allAccounts.filter((account) => account.id !== from)}
                            value={to}
                            onChange={setToId}
                        />
                    )}
                    <DateField label="Date" day={day} onChange={setDay} />
                </>
            )}

            <SheetActions>
                <Button variant="secondary" label="Cancel" onPress={close} style={{ flex: 1 }} />
                <Button
                    label={
                        needsConnection
                            ? "Holdings need a connection"
                            : isHolding
                              ? "Add holding"
                              : value
                                ? "Save entry"
                                : "Enter an amount"
                    }
                    disabled={blocked || pending || needsConnection}
                    onPress={save}
                    style={{ flex: 2 }}
                />
            </SheetActions>
        </Sheet>
    );
}

const makeStyles = (colors: Colors) =>
    StyleSheet.create({
        field: { gap: 5 },
        modeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
        screenshot: {
            padding: 7,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: colors.divider,
        },
        label: { fontFamily: fonts.regular, fontSize: 12, color: colors.quiet },
        date: { justifyContent: "center" },
        dateText: { fontFamily: fonts.regular, fontSize: 15, color: colors.text },
        amountRow: { flexDirection: "row", alignItems: "center", gap: 8 },
        amountField: { flex: 1 },
        currencySwitch: {
            paddingHorizontal: 8,
            paddingVertical: 2,
            borderRadius: 6,
            borderWidth: 1,
            borderColor: colors.divider,
        },
        currencyText: { fontFamily: fonts.medium, fontSize: 24, color: colors.accent },
        inlineInput: { minWidth: 120, minHeight: 32, paddingVertical: 4 },
        pair: { flexDirection: "row", gap: 10 },
        half: { flex: 1 },
        warning: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: -8 },
        warningText: { flexShrink: 1, fontFamily: fonts.medium, fontSize: 12, color: colors.danger },
        total: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, fontVariant: ["tabular-nums"] },
    });
