import { useDeleteHolding, useHoldingHistory, useSellHolding, useUpdateHolding } from "@lofit/api";
import { euros, formatAmount, formatEuros, holdingValue, unitCost } from "@lofit/domain";
import type { Holding } from "@lofit/domain";
import { useState } from "react";
import { PriceChart } from "./priceChart";
import { Sheet } from "./sheet";

const dayFormat = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
});

function inCurrency(holding: Holding, amount: number): string {
    return new Intl.NumberFormat("en-IE", {
        style: "currency",
        currency: holding.currency,
    }).format(amount / 100);
}

function parseNumber(input: string): number | undefined {
    const value = Number.parseFloat(input.replace(",", "."));
    return Number.isFinite(value) && value > 0 ? value : undefined;
}

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

    const [selling, setSelling] = useState(false);
    const [quantity, setQuantity] = useState(String(holding.quantity));
    const [paid, setPaid] = useState((holding.cost / 100).toFixed(2));
    const [units, setUnits] = useState("");
    const [price, setPrice] = useState((holding.nativePrice / 100).toFixed(2));
    const [since, setSince] = useState(holding.heldSince);

    const pending = update.isPending || sell.isPending || remove.isPending;

    const held = parseNumber(quantity);
    const cost = parseNumber(paid);
    const sold = parseNumber(units);
    const at = parseNumber(price);

    const proceeds = sold && at ? sold * at : 0;

    function save() {
        if (!held || cost === undefined || !since || pending) return;

        update.mutate(
            { id: holding.id, quantity: held, cost: euros(cost), heldSince: since },
            {
                onSuccess: () => {
                    onDone(`Updated ${holding.symbol}`);
                    onClose();
                },
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
            <div className="sheet-head">
                <h4 className="sheet-title">{holding.symbol}</h4>
                <span className="sheet-note">
                    {holding.name} · {accountName} · worth {formatEuros(holdingValue(holding))} · since{" "}
                    {dayFormat.format(new Date(holding.heldSince))}
                </span>
            </div>

            {holding.quote &&
                (history.data && history.data.points.length > 1 ? (
                    <PriceChart
                        points={history.data.points}
                        currency={history.data.currency}
                        cost={holding.cost > 0 ? unitCost(holding, history.data.perEuroWhenBought) : undefined}
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
                                ? `€ ${formatAmount(euros(proceeds))} into ${accountName}`
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
                            Worth {inCurrency(holding, holding.nativePrice)} each, refreshed
                            hourly
                        </span>

                        <div className="sheet-actions">
                            <button className="btn btn-secondary sheet-remove" onClick={drop}>
                                Remove
                            </button>
                            <button
                                className="btn btn-primary sheet-save"
                                disabled={!held || cost === undefined || !since || pending}
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
