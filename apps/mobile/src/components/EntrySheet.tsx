import {
    useAccounts,
    useAddHolding,
    useAddTag,
    useAddTransaction,
    useGroups,
    useRenameTag,
    useTags,
    useUpdateTransaction,
} from "@lofit/api";
import { ASSET_TYPE_LABELS, ASSET_TYPES, CURRENCIES, euros, investingGroups, KIND_LABELS } from "@lofit/domain";
import type {
    Account,
    AssetType,
    Currency,
    NewHolding,
    NewTransaction,
    QuoteRef,
    Transaction,
    TransactionKind,
} from "@lofit/domain";
import { currencyFormat, dayFormat, parsePositive } from "@lofit/view";
import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { colors, fonts } from "../theme";
import { AmountInput } from "./AmountInput";
import { Button } from "./Button";
import { Chip, ChipRow, Segmented } from "./Choices";
import { Field, fieldStyles } from "./Field";
import { pickDay } from "./RangePicker";
import { Sheet, SheetActions } from "./Sheet";
import { useOnline } from "../connectivity";
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

function today(): string {
    return new Date().toISOString().slice(0, 10);
}

function toInstant(day: string): string {
    return `${day}T${new Date().toISOString().slice(11)}`;
}

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

type Props = {
    entry?: Transaction | undefined;
    onClose: () => void;
};

export function EntrySheet({ entry, onClose }: Props) {
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

    const value = parsePositive(amount);
    const units = parsePositive(quantity);

    const blocked = isHolding
        ? !value || !units || !symbol.trim() || !heldAt || !day
        : !value || !name.trim() || !from || (mode === "transfer" && (!to || to === from));

    const pending = addEntry.isPending || addPosition.isPending || updateEntry.isPending;
    const needsConnection = isHolding && !online;

    function nextCurrency() {
        const at = CURRENCIES.indexOf(currency);
        setCurrency(CURRENCIES[(at + 1) % CURRENCIES.length]!);
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
        if (!wanted) return;

        const tag = await addNewTag.mutateAsync({ name: wanted });
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
            tagIds,
            accountId: from,
            amount: signed,
            occurredAt: toInstant(day),
            ...(mode === "transfer" ? { toAccountId: to } : {}),
        };

        if (entry) {
            updateEntry.mutate({ id: entry.id, draft: transaction });
            show(`Updated ${name.trim()}`);
        } else {
            addEntry.mutate(transaction);
            show(`Saved ${name.trim()}`);
        }
        onClose();
    }

    function save() {
        if (blocked || !value) return;
        if (isHolding) {
            if (units) saveHolding(value, units);
            return;
        }
        saveTransaction(value);
    }

    return (
        <Sheet
            title={editing ? "Edit entry" : "Log an entry"}
            note={isHolding ? "Manual · price per unit" : "Manual"}
            onClose={onClose}
        >
            <Segmented options={editing ? TRANSACTION_MODES : ALL_MODES} value={mode} onChange={setMode} />

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
            ) : (
                <ChipRow>
                    {(tags ?? []).map((tag) => {
                        const chosen = tagIds.indexOf(tag.id);
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
                <Button variant="secondary" label="Cancel" onPress={onClose} style={{ flex: 1 }} />
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

const styles = StyleSheet.create({
    field: { gap: 5 },
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
    total: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, fontVariant: ["tabular-nums"] },
});
