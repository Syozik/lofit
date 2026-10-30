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
    currencyLabel,
    currencySymbol,
    displayCurrency,
    euros,
    investingGroups,
    isCurrency,
    KIND_LABELS,
    tagsFor,
} from "@lofit/domain";
import type {
    AssetType,
    Currency,
    ImportDraft,
    QuoteRef,
    NewHolding,
    NewTransaction,
    ScreenshotImport as Found,
    Transaction,
    TransactionKind,
} from "@lofit/domain";
import { parsePositive } from "@lofit/view";
import { ImagePlus } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "../toast";
import { ScreenshotImport } from "./screenshotImport";
import { Sheet } from "./sheet";

type EntryMode = TransactionKind | "holding";

const MODES: readonly EntryMode[] = ["expense", "income", "transfer", "holding"];

const TRANSACTION_MODES: readonly EntryMode[] = ["expense", "income", "transfer"];

const MODE_LABELS: Record<EntryMode, string> = { ...KIND_LABELS, holding: "Holding" };


function money(currency: string, amount: number): string {
    return new Intl.NumberFormat("en-IE", { style: "currency", currency }).format(amount);
}

function today(): string {
    return new Date().toISOString().slice(0, 10);
}

function toInstant(day: string): string {
    return `${day}T${new Date().toISOString().slice(11)}`;
}

type Queue = {
    drafts: readonly ImportDraft[];
    at: number;
    added: number;
    skipped: number;
    source: string;
    account: string;
};

function addedOf(queue: Queue): string {
    return `Added ${queue.added} of ${queue.drafts.length} entries`;
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
    const typed = entry?.original ?? entry;
    const [amount, setAmount] = useState(typed ? (Math.abs(typed.amount) / 100).toFixed(2) : "");
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
    const [currency, setCurrency] = useState<Currency>(entry?.original?.currency ?? displayCurrency);
    const [liveSymbol, setLiveSymbol] = useState("");
    const [ownTicker, setOwnTicker] = useState(false);
    const [screenshot, setScreenshot] = useState<File | null>(null);
    const [queue, setQueue] = useState<Queue | null>(null);
    const picker = useRef<HTMLInputElement>(null);

    const editing = entry !== undefined;
    const draft = queue?.drafts[queue.at];
    const isHolding = mode === "holding";
    const fitting = isHolding ? [] : tagsFor(tags ?? [], mode);
    const chosenIds = tagIds.filter((id) => fitting.some((tag) => tag.id === id));

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

    useEffect(() => {
        if (editing || screenshot || queue) return;

        function paste(event: ClipboardEvent) {
            const image = [...(event.clipboardData?.files ?? [])].find((file) =>
                file.type.startsWith("image/"),
            );
            if (!image) return;
            event.preventDefault();
            setScreenshot(image);
        }

        document.addEventListener("paste", paste);
        return () => document.removeEventListener("paste", paste);
    }, [editing, screenshot, queue]);

    const fill = useCallback((next: ImportDraft, account: string) => {
        setMode(next.kind);
        setAmount((Math.abs(next.amount) / 100).toFixed(2));
        setName(next.name);
        setTagIds(next.kind === "transfer" ? [] : [...next.tagIds]);
        setDay(next.day);
        setFromId(next.accountId ?? account);
        setToId(next.toAccountId ?? "");
        setCurrency(isCurrency(next.currency) ? next.currency : displayCurrency());
        setNewTag(undefined);
        setRenaming(null);
    }, []);

    const begin = useCallback(
        (found: Found) => {
            if (!screenshot) return;
            const first = found.drafts[0];
            if (!first) return;
            setQueue({
                drafts: found.drafts,
                at: 0,
                added: 0,
                skipped: found.skipped,
                source: screenshot.type === "application/pdf" ? "statement" : "screenshot",
                account: from,
            });
            fill(first, from);
            setScreenshot(null);
        },
        [screenshot, from, fill],
    );

    function advance(added: number) {
        if (!queue) return;
        const at = queue.at + 1;
        const next = queue.drafts[at];
        if (!next) {
            onSaved(addedOf({ ...queue, added }));
            onClose();
            return;
        }
        setQueue({ ...queue, at, added });
        fill(next, queue.account);
    }

    function close() {
        if (queue && queue.added > 0) onSaved(addedOf(queue));
        onClose();
    }

    function switchMode(next: EntryMode) {
        setMode(next);
        if (next === "holding") return;
        const allowed = tagsFor(tags ?? [], next);
        setTagIds((chosen) => chosen.filter((id) => allowed.some((tag) => tag.id === id)));
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
            tagIds: chosenIds,
            accountId: from,
            amount: signed,
            occurredAt: toInstant(day),
            ...(mode === "transfer" ? { toAccountId: to } : {}),
            ...(currency !== displayCurrency() ? { currency } : {}),
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
                if (queue) {
                    advance(queue.added + 1);
                    return;
                }
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

    if (screenshot) {
        return (
            <Sheet label={screenshot.type === "application/pdf" ? "From statement" : "From screenshot"} onClose={onClose}>
                <ScreenshotImport
                    file={screenshot}
                    onBack={() => setScreenshot(null)}
                    onClose={onClose}
                    onFound={begin}
                />
            </Sheet>
        );
    }

    return (
        <Sheet label={editing ? "Edit entry" : "Log an entry"} onClose={close}>
            <div className={`sheet-head ${queue ? "import-head" : ""}`}>
                <h4 className="sheet-title">{editing ? "Edit entry" : "Log an entry"}</h4>
                {queue ? (
                    <>
                        <span className="sheet-note">
                            From {queue.source} · {queue.at + 1} of {queue.drafts.length}
                        </span>
                        <button
                            className="btn btn-ghost sheet-import"
                            disabled={pending}
                            onClick={() => advance(queue.added)}
                        >
                            Skip
                        </button>
                        {queue.at === 0 && queue.skipped > 0 && (
                            <span className="sheet-note import-skipped">
                                Skipped {queue.skipped} already logged
                            </span>
                        )}
                    </>
                ) : editing || isHolding ? (
                    <span className="sheet-note">
                        {isHolding ? "Manual · price per unit" : "Manual"}
                    </span>
                ) : (
                    <button
                        className="btn btn-ghost sheet-import"
                        title="Or paste an image"
                        onClick={() => picker.current?.click()}
                    >
                        <ImagePlus size={15} strokeWidth={1.5} aria-hidden />
                        From screenshot or statement
                    </button>
                )}
                <input
                    ref={picker}
                    type="file"
                    accept="image/*,application/pdf"
                    hidden
                    onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.target.value = "";
                        if (file) setScreenshot(file);
                    }}
                />
            </div>

            <div className="seg sheet-kinds">
                {(editing || queue ? TRANSACTION_MODES : MODES).map((option) => (
                    <label key={option} className="seg-opt">
                        <input
                            type="radio"
                            name="entry-mode"
                            checked={mode === option}
                            onChange={() => switchMode(option)}
                        />
                        {MODE_LABELS[option]}
                    </label>
                ))}
            </div>

            <div className="sheet-amount">
                <label className="sheet-currency switchable">
                    {currencySymbol(currency)}
                    <select
                        aria-label="Currency"
                        value={currency}
                        onChange={(event) => setCurrency(event.target.value as Currency)}
                    >
                        {CURRENCIES.map((option) => (
                            <option key={option} value={option}>
                                {currencyLabel(option)}
                            </option>
                        ))}
                    </select>
                </label>
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

            {currency !== displayCurrency() && !isHolding && (
                <span className="sheet-fx">
                    Converted to {displayCurrency()} at the rate on {day}
                </span>
            )}

            {draft?.currency && !isCurrency(draft.currency) && (
                <span className="import-warning">
                    Shown in {draft.currency} on the {queue?.source} — check the amount
                </span>
            )}

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
            ) : mode === "transfer" ? null : (
                <div className="sheet-tags">
                    <div className="sheet-chips">
                        {fitting.map((tag) => {
                            const chosen = chosenIds.indexOf(tag.id);
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
                <button className="btn btn-secondary" onClick={close}>
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
