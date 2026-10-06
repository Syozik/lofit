import {
    useAccounts,
    useGroups,
    useAddHolding,
    useAddTag,
    useAddTransaction,
    useRenameTag,
    useTags,
    useUpdateTransaction,
} from "@lofit/api";
import {
    ASSET_TYPE_LABELS,
    ASSET_TYPES,
    CURRENCIES,
    euros,
    investingGroups,
    KIND_LABELS,
} from "@lofit/domain";
import type {
    AssetType,
    Currency,
    QuoteRef,
    NewHolding,
    NewTransaction,
    Transaction,
    TransactionKind,
} from "@lofit/domain";
import { parsePositive } from "@lofit/view";
import { useRef, useState } from "react";
import { useToast } from "../toast";
import { Sheet } from "./sheet";

type EntryMode = TransactionKind | "holding";

const MODES: readonly EntryMode[] = ["expense", "income", "transfer", "holding"];

const TRANSACTION_MODES: readonly EntryMode[] = ["expense", "income", "transfer"];

const MODE_LABELS: Record<EntryMode, string> = { ...KIND_LABELS, holding: "Holding" };

const CURRENCY_SYMBOLS: Record<Currency, string> = { EUR: "€", USD: "$" };

function money(currency: string, amount: number): string {
    return new Intl.NumberFormat("en-IE", { style: "currency", currency }).format(amount);
}

function today(): string {
    return new Date().toISOString().slice(0, 10);
}

function toInstant(day: string): string {
    return `${day}T${new Date().toISOString().slice(11)}`;
}

type Props = {
    entry?: Transaction;
    onClose: () => void;
    onSaved: (message: string) => void;
};

const DOUBLE_TAP_MS = 350;

export function EntrySheet({ entry, onClose, onSaved }: Props) {
    const { data: accounts } = useAccounts();
    const { data: groups } = useGroups();
    const { data: tags } = useTags();
    const addEntry = useAddTransaction();
    const addPosition = useAddHolding();
    const addNewTag = useAddTag();
    const rename = useRenameTag();
    const show = useToast();
    const updateEntry = useUpdateTransaction();

    const [mode, setMode] = useState<EntryMode>(entry?.kind ?? "expense");
    const [amount, setAmount] = useState(entry ? (Math.abs(entry.amount) / 100).toFixed(2) : "");
    const [name, setName] = useState(entry?.name ?? "");
    const [tagIds, setTagIds] = useState<string[]>([...(entry?.tagIds ?? [])]);
    const [newTag, setNewTag] = useState<string | undefined>(undefined);
    const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
    const lastTap = useRef<{ id: string; at: number } | null>(null);
    const [day, setDay] = useState(entry ? entry.occurredAt.slice(0, 10) : today);
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

    const mirrored = assetType === "crypto" ? "" : symbol.trim().toUpperCase();
    const ticker = ownTicker ? liveSymbol : mirrored;

    const investing = new Set(investingGroups(groups ?? []).map((group) => group.id));
    const brokerages = (accounts ?? []).filter((account) => investing.has(account.groupId));

    const from = fromId || accounts?.[0]?.id || "";
    const heldAt = custodianId || brokerages[0]?.id || "";
    const to = toId || accounts?.find((account) => account.id !== from)?.id || "";

    const value = parsePositive(amount);
    const units = parsePositive(quantity);

    const blocked = isHolding
        ? !value || !units || !symbol.trim() || !heldAt || !day
        : !value || !name.trim() || !from || (mode === "transfer" && (!to || to === from));

    const pending = addEntry.isPending || addPosition.isPending || updateEntry.isPending;

    function nextCurrency() {
        const at = CURRENCIES.indexOf(currency);
        setCurrency(CURRENCIES[(at + 1) % CURRENCIES.length]!);
    }

    function toggleTag(id: string) {
        setTagIds((chosen) =>
            chosen.includes(id) ? chosen.filter((other) => other !== id) : [...chosen, id],
        );
    }

    function tapTag(id: string, name: string, now: number) {
        toggleTag(id);

        if (lastTap.current?.id === id && now - lastTap.current.at < DOUBLE_TAP_MS) {
            lastTap.current = null;
            setRenaming({ id, name });
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

        rename.mutate(
            { id: renaming.id, name: wanted },
            { onError: (error) => show(error.message.replace(/^API \d+: /, "")) },
        );
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
                onSaved(`Added ${ticker}`);
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
            updateEntry.mutate(
                { id: entry.id, draft: transaction },
                {
                    onSuccess: () => {
                        onSaved(`Updated ${name.trim()}`);
                        onClose();
                    },
                },
            );
            return;
        }

        addEntry.mutate(transaction, {
            onSuccess: () => {
                onSaved(`Saved ${name.trim()}`);
                onClose();
            },
        });
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
        <Sheet label={editing ? "Edit entry" : "Log an entry"} onClose={onClose}>
            <div className="sheet-head">
                <h4 className="sheet-title">{editing ? "Edit entry" : "Log an entry"}</h4>
                <span className="sheet-note">
                    {isHolding ? "Manual · price per unit" : "Manual"}
                </span>
            </div>

            <div className="seg sheet-kinds">
                {(editing ? TRANSACTION_MODES : MODES).map((option) => (
                    <label key={option} className="seg-opt">
                        <input
                            type="radio"
                            name="entry-mode"
                            checked={mode === option}
                            onChange={() => setMode(option)}
                        />
                        {MODE_LABELS[option]}
                    </label>
                ))}
            </div>

            <div className="sheet-amount">
                {isHolding ? (
                    <button
                        className="sheet-currency switchable"
                        aria-label={`Priced in ${currency}, tap to change`}
                        onClick={nextCurrency}
                    >
                        {CURRENCY_SYMBOLS[currency]}
                    </button>
                ) : (
                    <span className="sheet-currency">€</span>
                )}
                <input
                    autoComplete="off"
                    className="sheet-amount-input"
                    inputMode="decimal"
                    placeholder="0.00"
                    aria-label={isHolding ? "Price per unit" : "Amount"}
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                />
            </div>

            {isHolding ? (
                <div className="sheet-chips">
                    {ASSET_TYPES.map((key) => (
                        <button
                            key={key}
                            className={`tag sheet-chip ${assetType === key ? "selected" : ""}`}
                            onClick={() => setAssetType(key)}
                        >
                            {ASSET_TYPE_LABELS[key]}
                        </button>
                    ))}
                </div>
            ) : (
                <div className="sheet-tags">
                    <div className="sheet-chips">
                        {(tags ?? []).map((tag) => {
                            const chosen = tagIds.indexOf(tag.id);
                            if (renaming?.id === tag.id) {
                                return (
                                    <input
                                        autoComplete="off"
                                        key={tag.id}
                                        className="input sheet-new-tag"
                                        autoFocus
                                        aria-label={`Rename ${tag.name}`}
                                        value={renaming.name}
                                        onFocus={(event) => event.currentTarget.select()}
                                        onChange={(event) =>
                                            setRenaming({ id: tag.id, name: event.target.value })
                                        }
                                        onBlur={(event) => {
                                            if (!event.currentTarget.dataset.cancelled)
                                                finishRename();
                                        }}
                                        onKeyDown={(event) => {
                                            if (event.key === "Enter") {
                                                event.preventDefault();
                                                finishRename();
                                            }
                                            if (event.key === "Escape") {
                                                event.currentTarget.dataset.cancelled = "true";
                                                setRenaming(null);
                                            }
                                        }}
                                    />
                                );
                            }
                            return (
                                <button
                                    key={tag.id}
                                    className={`tag sheet-chip ${chosen === 0 ? "selected owner" : chosen > 0 ? "selected" : ""}`}
                                    onClick={(event) => tapTag(tag.id, tag.name, event.timeStamp)}
                                >
                                    {tag.name}
                                </button>
                            );
                        })}
                        {newTag === undefined ? (
                            <button className="tag sheet-chip" onClick={() => setNewTag("")}>
                                + New tag
                            </button>
                        ) : (
                            <input
                                autoComplete="off"
                                className="input sheet-new-tag"
                                autoFocus
                                placeholder="New tag"
                                value={newTag}
                                onChange={(event) => setNewTag(event.target.value)}
                                onBlur={createTag}
                                onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                        event.preventDefault();
                                        void createTag();
                                    }
                                    if (event.key === "Escape") setNewTag(undefined);
                                }}
                            />
                        )}
                    </div>
                </div>
            )}

            <div className="sheet-fields">
                {isHolding ? (
                    <>
                        <div className="sheet-pair">
                            <label className="field">
                                <span>Symbol</span>
                                <input
                                    autoComplete="off"
                                    className="input sheet-symbol"
                                    placeholder="VWRL"
                                    value={symbol}
                                    onChange={(event) => setSymbol(event.target.value)}
                                />
                            </label>
                            <label className="field">
                                <span>Quantity</span>
                                <input
                                    autoComplete="off"
                                    className="input"
                                    inputMode="decimal"
                                    placeholder="10"
                                    value={quantity}
                                    onChange={(event) => setQuantity(event.target.value)}
                                />
                            </label>
                        </div>

                        <label className="field">
                            <span>Name</span>
                            <input
                                autoComplete="off"
                                className="input"
                                placeholder="Vanguard FTSE All-World"
                                value={name}
                                onChange={(event) => setName(event.target.value)}
                            />
                        </label>

                        <label className="field">
                            <span>Live price symbol</span>
                            <input
                                autoComplete="off"
                                className="input sheet-symbol"
                                placeholder={assetType === "crypto" ? "bitcoin" : "GOOGL"}
                                value={ticker}
                                onChange={(event) => {
                                    setOwnTicker(true);
                                    setLiveSymbol(event.target.value);
                                }}
                            />
                            <span className="sheet-hint">
                                {assetType === "crypto"
                                    ? "CoinGecko id · empty keeps the price you typed"
                                    : "NASDAQ and NYSE need no suffix · European listings do, e.g. VWRL.AS"}
                            </span>
                        </label>

                        <label className="field">
                            <span>Held at</span>
                            <select
                                className="input"
                                value={heldAt}
                                onChange={(event) => setCustodianId(event.target.value)}
                            >
                                {brokerages.map((account) => (
                                    <option key={account.id} value={account.id}>
                                        {account.name}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="field">
                            <span>Bought on</span>
                            <input
                                autoComplete="off"
                                className="input"
                                type="date"
                                max={today()}
                                value={day}
                                onChange={(event) => setDay(event.target.value)}
                            />
                        </label>

                        {value && units && (
                            <span className="sheet-total">
                                Position value {money(currency, value * units)}
                            </span>
                        )}
                    </>
                ) : (
                    <>
                        <label className="field">
                            <span>Description</span>
                            <input
                                autoComplete="off"
                                className="input"
                                placeholder="Albert Heijn"
                                value={name}
                                onChange={(event) => setName(event.target.value)}
                            />
                        </label>

                        <label className="field">
                            <span>{mode === "transfer" ? "From" : "Account"}</span>
                            <select
                                className="input"
                                value={from}
                                onChange={(event) => setFromId(event.target.value)}
                            >
                                {accounts?.map((account) => (
                                    <option key={account.id} value={account.id}>
                                        {account.name}
                                    </option>
                                ))}
                            </select>
                        </label>

                        {mode === "transfer" && (
                            <label className="field">
                                <span>To</span>
                                <select
                                    className="input"
                                    value={to}
                                    onChange={(event) => setToId(event.target.value)}
                                >
                                    {accounts
                                        ?.filter((account) => account.id !== from)
                                        .map((account) => (
                                            <option key={account.id} value={account.id}>
                                                {account.name}
                                            </option>
                                        ))}
                                </select>
                            </label>
                        )}

                        <label className="field">
                            <span>Date</span>
                            <input
                                autoComplete="off"
                                className="input"
                                type="date"
                                value={day}
                                onChange={(event) => setDay(event.target.value)}
                            />
                        </label>
                    </>
                )}
            </div>

            <div className="sheet-actions">
                <button className="btn btn-secondary" onClick={onClose}>
                    Cancel
                </button>
                <button
                    className="btn btn-primary sheet-save"
                    disabled={blocked || pending}
                    onClick={save}
                >
                    {isHolding ? "Add holding" : value ? "Save entry" : "Enter an amount"}
                </button>
            </div>
        </Sheet>
    );
}
