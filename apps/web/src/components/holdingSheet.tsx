import { useDeleteHolding, useHoldingHistory, useSellHolding, useUpdateHolding } from "@lofit/api";
import { euros, formatAmount, formatMoney, holdingValue, unitCost, withSymbol } from "@lofit/domain";
import type { Holding } from "@lofit/domain";
import { dayFormat, followsSymbol, inCurrency, parsePositive, quoteFor, quoteTicker } from "@lofit/view";
import { useState } from "react";
import { useDesktop } from "../useDesktop";
import { PriceChart } from "./priceChart";
import { Sheet } from "./sheet";

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
    const desktop = useDesktop();

    const [selling, setSelling] = useState(false);
    const [quantity, setQuantity] = useState(String(holding.quantity));
    const [paid, setPaid] = useState((holding.cost / 100).toFixed(2));
    const [units, setUnits] = useState("");
    const [price, setPrice] = useState((holding.nativePrice / 100).toFixed(2));
    const [since, setSince] = useState(holding.heldSince);
    const [symbol, setSymbol] = useState(holding.symbol);
    const [name, setName] = useState(holding.name);
    const [ticker, setTicker] = useState(quoteTicker(holding.quote));
    const [ownTicker, setOwnTicker] = useState(!followsSymbol(holding));

    const pending = update.isPending || sell.isPending || remove.isPending;

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
                    />
                ) : (
                    <div className="price-chart price-pending">
                        {history.isPending ? "Loading prices…" : "No price history for this symbol"}
                    </div>
                ))}

            <div className="seg sheet-kinds">
                <label className="seg-opt">
                    <input
                        type="radio"
                        name="holding-mode"
                        checked={!selling}
                        onChange={() => setSelling(false)}
                    />
                    Correct
                </label>
                <label className="seg-opt">
                    <input
                        type="radio"
                        name="holding-mode"
                        checked={selling}
                        onChange={() => setSelling(true)}
                    />
                    Sell
                </label>
            </div>

            <div className="sheet-fields">
                {selling ? (
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
