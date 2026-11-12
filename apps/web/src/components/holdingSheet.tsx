import {
    useDeleteHolding,
    useDeleteTrade,
    useHoldingHistory,
    useHoldingTrades,
    useSellHolding,
    useUpdateHolding,
    useUpdateTrade,
} from "@lofit/api";
import { euros, formatAmount, formatMoney, holdingValue, unitCost, withSymbol } from "@lofit/domain";
import type { Holding, Trade } from "@lofit/domain";
import {
    dayFormat,
    followsSymbol,
    inCurrency,
    parsePositive,
    quoteFor,
    quoteTicker,
    tradeGainLabel,
    tradeNote,
    tradeUnits,
} from "@lofit/view";
import { useState } from "react";
import { useDesktop } from "../useDesktop";
import { PriceChart } from "./priceChart";
import { Sheet } from "./sheet";

type Mode = "correct" | "sell" | "history";

const MODES: readonly { value: Mode; label: string }[] = [
    { value: "correct", label: "Correct" },
    { value: "sell", label: "Sell" },
    { value: "history", label: "History" },
];

type Props = {
    holding: Holding;
    accountName: string;
    onClose: () => void;
    onDone: (message: string) => void;
};

export function HoldingSheet({ holding, accountName, onClose, onDone }: Props) {
    const update = useUpdateHolding();
    const sell = useSellHolding();
    const remove = useDeleteHolding();
    const history = useHoldingHistory(holding.id);
    const trades = useHoldingTrades(holding.id);
    const undo = useDeleteTrade();
    const change = useUpdateTrade();
    const desktop = useDesktop();

    const [mode, setMode] = useState<Mode>("correct");
    const [quantity, setQuantity] = useState(String(holding.quantity));
    const [paid, setPaid] = useState((holding.cost / 100).toFixed(2));
    const [units, setUnits] = useState("");
    const [price, setPrice] = useState((holding.nativePrice / 100).toFixed(2));
    const [since, setSince] = useState(holding.heldSince);
    const [symbol, setSymbol] = useState(holding.symbol);
    const [name, setName] = useState(holding.name);
    const [ticker, setTicker] = useState(quoteTicker(holding.quote));
    const [ownTicker, setOwnTicker] = useState(!followsSymbol(holding));
    const [editing, setEditing] = useState<Trade | null>(null);
    const [boughtUnits, setBoughtUnits] = useState("");
    const [boughtPrice, setBoughtPrice] = useState("");
    const [boughtDay, setBoughtDay] = useState("");

    const buys = (trades.data ?? []).filter((trade) => trade.side === "buy").map((trade) => trade.day);
    const pending = update.isPending || sell.isPending || remove.isPending || undo.isPending || change.isPending;

    const held = parsePositive(quantity);
    const cost = parsePositive(paid);
    const sold = parsePositive(units);
    const at = parsePositive(price);

    const proceeds = sold && at ? sold * at : 0;
    const shown = symbol.trim().toUpperCase();
    const liveTicker = ownTicker ? ticker : shown;
    const ready = !!held && cost !== undefined && !!since && !!shown;

    function save() {
        if (!ready || pending) return;

        update.mutate(
            {
                id: holding.id,
                quantity: held,
                cost: euros(cost),
                heldSince: since,
                symbol: shown,
                name: name.trim() || shown,
                quote: quoteFor(holding.type, liveTicker),
            },
            {
                onSuccess: () => {
                    onDone(`Updated ${shown}`);
                    onClose();
                },
                onError: (error) => onDone(error.message),
            },
        );
    }

    function confirmSale() {
        if (!sold || !at || pending) return;

        sell.mutate(
            { id: holding.id, quantity: sold, price: euros(at) },
            {
                onSuccess: (result) => {
                    onDone(`Sold ${result.sold} ${holding.symbol} into ${accountName}`);
                    onClose();
                },
            },
        );
    }

    const removable = (trade: Trade) =>
        trade.side === "buy" && trade.source !== "opening" && trade.quantity < holding.quantity;

    function edit(trade: Trade) {
        setEditing(trade);
        setBoughtUnits(String(trade.quantity));
        setBoughtPrice((trade.price / 100).toFixed(2));
        setBoughtDay(trade.day);
    }

    function saveBuy() {
        const bought = parsePositive(boughtUnits);
        const each = parsePositive(boughtPrice);
        if (!editing || !bought || !each || !boughtDay || pending) return;

        change.mutate(
            { id: holding.id, tradeId: editing.id, quantity: bought, price: euros(each), day: boughtDay },
            {
                onSuccess: () => {
                    onDone(`Updated a buy of ${holding.symbol}`);
                    onClose();
                },
                onError: (error) => onDone(error.message),
            },
        );
    }

    function undoBuy(trade: Trade) {
        if (pending) return;

        undo.mutate(
            { id: holding.id, tradeId: trade.id },
            {
                onSuccess: () => {
                    onDone(`Removed a buy of ${holding.symbol}`);
                    onClose();
                },
                onError: (error) => onDone(error.message),
            },
        );
    }

    function drop() {
        if (pending) return;

        remove.mutate(holding.id, {
            onSuccess: () => {
                onDone(`Removed ${holding.symbol}`);
                onClose();
            },
        });
    }

    return (
        <Sheet label={holding.symbol} onClose={onClose}>
            <div className={desktop ? "sheet-head holding-head" : "sheet-head"}>
                <h4 className="sheet-title">{holding.symbol}</h4>
                {desktop && <span className="holding-head-name">{holding.name}</span>}
                <span className="sheet-note">
                    {!desktop && `${holding.name} · `}
                    {accountName} · worth {formatMoney(holdingValue(holding))} ·
                    since {dayFormat.format(new Date(holding.heldSince))}
                </span>
            </div>

            {holding.quote &&
                (history.data && history.data.points.length > 1 ? (
                    <PriceChart
                        points={history.data.points}
                        currency={history.data.currency}
                        cost={
                            holding.cost > 0
                                ? unitCost(holding, history.data.perBaseWhenBought)
                                : undefined
                        }
                        heldSince={holding.heldSince}
                        buys={buys}
                    />
                ) : (
                    <div className="price-chart price-pending">
                        {history.isPending ? "Loading prices…" : "No price history for this symbol"}
                    </div>
                ))}

            <div className="seg sheet-kinds">
                {MODES.map((option) => (
                    <label className="seg-opt" key={option.value}>
                        <input
                            type="radio"
                            name="holding-mode"
                            checked={mode === option.value}
                            onChange={() => setMode(option.value)}
                        />
                        {option.label}
                    </label>
                ))}
            </div>

            <div className="sheet-fields">
                {mode === "history" ? (
                    editing ? (
                        <>
                            <div className="sheet-pair">
                                <label className="field">
                                    <span>Units bought</span>
                                    <input
                                        autoComplete="off"
                                        className="input"
                                        inputMode="decimal"
                                        autoFocus
                                        value={boughtUnits}
                                        onChange={(event) => setBoughtUnits(event.target.value)}
                                    />
                                </label>
                                <label className="field">
                                    <span>Price each, {editing.currency}</span>
                                    <input
                                        autoComplete="off"
                                        className="input"
                                        inputMode="decimal"
                                        value={boughtPrice}
                                        onChange={(event) => setBoughtPrice(event.target.value)}
                                    />
                                </label>
                            </div>

                            <label className="field">
                                <span>Bought on</span>
                                <input
                                    autoComplete="off"
                                    className="input"
                                    type="date"
                                    value={boughtDay}
                                    onChange={(event) => setBoughtDay(event.target.value)}
                                />
                            </label>

                            <div className="sheet-actions">
                                {removable(editing) && (
                                    <button
                                        className="btn btn-secondary sheet-remove"
                                        disabled={pending}
                                        onClick={() => undoBuy(editing)}
                                    >
                                        Remove
                                    </button>
                                )}
                                <button className="btn btn-secondary" onClick={() => setEditing(null)}>
                                    Back
                                </button>
                                <button
                                    className="btn btn-primary sheet-save"
                                    disabled={
                                        !parsePositive(boughtUnits) || !parsePositive(boughtPrice) || !boughtDay || pending
                                    }
                                    onClick={saveBuy}
                                >
                                    {change.isPending ? "Saving…" : "Save"}
                                </button>
                            </div>
                        </>
                    ) : trades.data && trades.data.length > 0 ? (
                        <ul className="trade-rows">
                            {trades.data.map((trade) => {
                                const gain = trade.side === "buy" ? tradeGainLabel(trade, holding) : undefined;

                                return (
                                    <li key={trade.id}>
                                        <button
                                            className="trade-row"
                                            disabled={trade.side === "sell"}
                                            onClick={() => edit(trade)}
                                        >
                                            <span className="trade-main">
                                                <span>{tradeUnits(trade, holding.type)}</span>
                                                <span className="trade-note">
                                                    {dayFormat.format(new Date(trade.day))} · {tradeNote(trade)}
                                                </span>
                                            </span>
                                            <span className="trade-figures">
                                                <span>{formatMoney(trade.cost)}</span>
                                                {gain && (
                                                    <span className={`acct-change ${gain.favourable ? "up" : ""}`}>
                                                        {gain.text}
                                                    </span>
                                                )}
                                            </span>
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    ) : (
                        <span className="sheet-total">
                            {trades.isPending ? "Loading buys…" : "No buys recorded yet"}
                        </span>
                    )
                ) : mode === "sell" ? (
                    <>
                        <div className="sheet-pair">
                            <label className="field">
                                <span>Units to sell</span>
                                <input
                                    autoComplete="off"
                                    className="input"
                                    inputMode="decimal"
                                    autoFocus
                                    placeholder={String(holding.quantity)}
                                    value={units}
                                    onChange={(event) => setUnits(event.target.value)}
                                />
                            </label>
                            <label className="field">
                                <span>Price each</span>
                                <input
                                    autoComplete="off"
                                    className="input"
                                    inputMode="decimal"
                                    value={price}
                                    onChange={(event) => setPrice(event.target.value)}
                                />
                            </label>
                        </div>

                        <span className="sheet-total">
                            {proceeds > 0
                                ? `${withSymbol(formatAmount(euros(proceeds)))} into ${accountName}`
                                : `Proceeds go into ${accountName}`}
                        </span>

                        <div className="sheet-actions">
                            <button className="btn btn-secondary" onClick={onClose}>
                                Cancel
                            </button>
                            <button
                                className="btn btn-primary sheet-save"
                                disabled={!sold || !at || pending}
                                onClick={confirmSale}
                            >
                                {sell.isPending ? "Selling…" : "Sell"}
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="sheet-pair">
                            <label className="field">
                                <span>Symbol</span>
                                <input
                                    autoComplete="off"
                                    className="input sheet-symbol"
                                    value={symbol}
                                    onChange={(event) => setSymbol(event.target.value)}
                                />
                            </label>
                            <label className="field">
                                <span>Live price symbol</span>
                                <input
                                    autoComplete="off"
                                    className="input sheet-symbol"
                                    placeholder={holding.type === "crypto" ? "bitcoin" : "GOOGL"}
                                    value={liveTicker}
                                    onChange={(event) => {
                                        setOwnTicker(true);
                                        setTicker(event.target.value);
                                    }}
                                />
                            </label>
                        </div>

                        <label className="field">
                            <span>Name</span>
                            <input
                                autoComplete="off"
                                className="input"
                                value={name}
                                onChange={(event) => setName(event.target.value)}
                            />
                        </label>

                        <div className="sheet-pair">
                            <label className="field">
                                <span>Units held</span>
                                <input
                                    autoComplete="off"
                                    className="input"
                                    inputMode="decimal"
                                    value={quantity}
                                    onChange={(event) => setQuantity(event.target.value)}
                                />
                            </label>
                            <label className="field">
                                <span>Paid, in total</span>
                                <input
                                    autoComplete="off"
                                    className="input"
                                    inputMode="decimal"
                                    value={paid}
                                    onChange={(event) => setPaid(event.target.value)}
                                />
                            </label>
                        </div>

                        <label className="field">
                            <span>Held since</span>
                            <input
                                autoComplete="off"
                                className="input"
                                type="date"
                                value={since}
                                onChange={(event) => setSince(event.target.value)}
                            />
                        </label>

                        <span className="sheet-total">
                            Worth {inCurrency(holding, holding.nativePrice)} each, refreshed hourly
                        </span>

                        <div className="sheet-actions">
                            <button className="btn btn-secondary sheet-remove" onClick={drop}>
                                Remove
                            </button>
                            <button
                                className="btn btn-primary sheet-save"
                                disabled={!ready || pending}
                                onClick={save}
                            >
                                {update.isPending ? "Saving…" : "Save"}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </Sheet>
    );
}
