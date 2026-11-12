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
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Colors } from "../theme";
import { fonts, space, useStyles } from "../theme";
import { Button } from "./Button";
import { Segmented } from "./Choices";
import { Field, makeFieldStyles } from "./Field";
import { PriceChart } from "./PriceChart";
import { pickDay } from "./RangePicker";
import { Sheet, SheetActions } from "./Sheet";
import { useOnline } from "../connectivity";
import { useToast } from "./Toast";

type Mode = "correct" | "sell" | "history";

const MODES = [
    { value: "correct", label: "Correct" },
    { value: "sell", label: "Sell" },
    { value: "history", label: "History" },
] as const;

const today = () => new Date().toISOString().slice(0, 10);

type Props = {
    holding: Holding;
    accountName: string;
    onClose: () => void;
};

export function HoldingSheet({ holding, accountName, onClose }: Props) {
    const styles = useStyles(makeStyles);
    const fieldStyles = useStyles(makeFieldStyles);
    const update = useUpdateHolding();
    const sell = useSellHolding();
    const remove = useDeleteHolding();
    const history = useHoldingHistory(holding.id);
    const trades = useHoldingTrades(holding.id);
    const undo = useDeleteTrade();
    const change = useUpdateTrade();
    const show = useToast();
    const online = useOnline();

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
                    show(`Updated ${shown}`);
                    onClose();
                },
                onError: (error) => show(error.message),
            },
        );
    }

    function confirmSale() {
        if (!sold || !at || pending) return;
        sell.mutate(
            { id: holding.id, quantity: sold, price: euros(at) },
            {
                onSuccess: (result) => {
                    show(`Sold ${result.sold} ${holding.symbol} into ${accountName}`);
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
                    show(`Updated a buy of ${holding.symbol}`);
                    onClose();
                },
                onError: (error) => show(error.message),
            },
        );
    }

    function undoBuy(trade: Trade) {
        if (pending) return;
        undo.mutate(
            { id: holding.id, tradeId: trade.id },
            {
                onSuccess: () => {
                    show(`Removed a buy of ${holding.symbol}`);
                    onClose();
                },
                onError: (error) => show(error.message),
            },
        );
    }

    function drop() {
        if (pending) return;
        remove.mutate(holding.id, {
            onSuccess: () => {
                show(`Removed ${holding.symbol}`);
                onClose();
            },
        });
    }

    return (
        <Sheet
            title={holding.symbol}
            note={`${holding.name} · ${accountName} · worth ${formatMoney(holdingValue(holding))} · since ${dayFormat.format(new Date(holding.heldSince))}`}
            onClose={onClose}
        >
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
                    <View style={styles.pending}>
                        <Text style={styles.pendingText}>
                            {history.isPending
                                ? online
                                    ? "Loading prices…"
                                    : "Price history needs a connection"
                                : "No price history for this symbol"}
                        </Text>
                    </View>
                ))}

            <Segmented options={MODES} value={mode} onChange={setMode} />

            {mode === "history" ? (
                editing ? (
                    <>
                        <View style={styles.pair}>
                            <View style={styles.half}>
                                <Field
                                    label="Units bought"
                                    keyboardType="decimal-pad"
                                    value={boughtUnits}
                                    onChangeText={setBoughtUnits}
                                />
                            </View>
                            <View style={styles.half}>
                                <Field
                                    label={`Price each, ${editing.currency}`}
                                    keyboardType="decimal-pad"
                                    value={boughtPrice}
                                    onChangeText={setBoughtPrice}
                                />
                            </View>
                        </View>

                        <View style={styles.field}>
                            <Text style={styles.label}>Bought on</Text>
                            <Pressable
                                style={[fieldStyles.input, styles.dateInput]}
                                onPress={() => pickDay(boughtDay, setBoughtDay, { max: today() })}
                            >
                                <Text style={styles.dateText}>{dayFormat.format(new Date(boughtDay))}</Text>
                            </Pressable>
                        </View>

                        <SheetActions>
                            {removable(editing) && (
                                <Button
                                    variant="danger"
                                    label="Remove"
                                    disabled={!online || pending}
                                    onPress={() => undoBuy(editing)}
                                    style={{ flex: 1 }}
                                />
                            )}
                            <Button
                                variant="secondary"
                                label="Back"
                                onPress={() => setEditing(null)}
                                style={{ flex: 1 }}
                            />
                            <Button
                                label={online ? (change.isPending ? "Saving…" : "Save") : "Needs a connection"}
                                disabled={
                                    !parsePositive(boughtUnits) || !parsePositive(boughtPrice) || pending || !online
                                }
                                onPress={saveBuy}
                                style={{ flex: 2 }}
                            />
                        </SheetActions>
                    </>
                ) : trades.data && trades.data.length > 0 ? (
                    <View>
                        {trades.data.map((trade) => {
                            const gain = trade.side === "buy" ? tradeGainLabel(trade, holding) : undefined;

                            return (
                                <Pressable
                                    style={styles.trade}
                                    key={trade.id}
                                    disabled={trade.side === "sell"}
                                    onPress={() => edit(trade)}
                                >
                                    <View style={styles.tradeMain}>
                                        <Text style={styles.tradeText}>{tradeUnits(trade, holding.type)}</Text>
                                        <Text style={styles.tradeNote}>
                                            {dayFormat.format(new Date(trade.day))} · {tradeNote(trade)}
                                        </Text>
                                    </View>
                                    <View style={styles.tradeFigures}>
                                        <Text style={styles.tradeText}>{formatMoney(trade.cost)}</Text>
                                        {gain && (
                                            <Text style={[styles.tradeNote, gain.favourable && styles.up]}>
                                                {gain.text}
                                            </Text>
                                        )}
                                    </View>
                                </Pressable>
                            );
                        })}
                    </View>
                ) : (
                    <Text style={styles.total}>
                        {trades.isPending
                            ? online
                                ? "Loading buys…"
                                : "Buys need a connection"
                            : "No buys recorded yet"}
                    </Text>
                )
            ) : mode === "sell" ? (
                <>
                    <View style={styles.pair}>
                        <View style={styles.half}>
                            <Field
                                label="Units to sell"
                                keyboardType="decimal-pad"
                                placeholder={String(holding.quantity)}
                                value={units}
                                onChangeText={setUnits}
                                autoFocus
                            />
                        </View>
                        <View style={styles.half}>
                            <Field
                                label="Price each"
                                keyboardType="decimal-pad"
                                value={price}
                                onChangeText={setPrice}
                            />
                        </View>
                    </View>
                    <Text style={styles.total}>
                        {proceeds > 0
                            ? `${withSymbol(formatAmount(euros(proceeds)))} into ${accountName}`
                            : `Proceeds go into ${accountName}`}
                    </Text>
                    <SheetActions>
                        <Button
                            variant="secondary"
                            label="Cancel"
                            onPress={onClose}
                            style={{ flex: 1 }}
                        />
                        <Button
                            label={online ? (sell.isPending ? "Selling…" : "Sell") : "Needs a connection"}
                            disabled={!sold || !at || pending || !online}
                            onPress={confirmSale}
                            style={{ flex: 2 }}
                        />
                    </SheetActions>
                </>
            ) : (
                <>
                    <View style={styles.pair}>
                        <View style={styles.half}>
                            <Field
                                label="Symbol"
                                autoCapitalize="characters"
                                autoCorrect={false}
                                value={symbol}
                                onChangeText={setSymbol}
                            />
                        </View>
                        <View style={styles.half}>
                            <Field
                                label="Live price symbol"
                                autoCapitalize="none"
                                autoCorrect={false}
                                placeholder={holding.type === "crypto" ? "bitcoin" : "GOOGL"}
                                value={liveTicker}
                                onChangeText={(next) => {
                                    setOwnTicker(true);
                                    setTicker(next);
                                }}
                            />
                        </View>
                    </View>

                    <Field label="Name" value={name} onChangeText={setName} />

                    <View style={styles.pair}>
                        <View style={styles.half}>
                            <Field
                                label="Units held"
                                keyboardType="decimal-pad"
                                value={quantity}
                                onChangeText={setQuantity}
                            />
                        </View>
                        <View style={styles.half}>
                            <Field
                                label="Paid, in total"
                                keyboardType="decimal-pad"
                                value={paid}
                                onChangeText={setPaid}
                            />
                        </View>
                    </View>

                    <View style={styles.field}>
                        <Text style={styles.label}>Held since</Text>
                        <Pressable
                            style={[fieldStyles.input, styles.dateInput]}
                            onPress={() => pickDay(since, setSince, { max: today() })}
                        >
                            <Text style={styles.dateText}>{dayFormat.format(new Date(since))}</Text>
                        </Pressable>
                    </View>

                    <Text style={styles.total}>
                        Worth {inCurrency(holding, holding.nativePrice)} each, refreshed hourly
                    </Text>

                    <SheetActions>
                        <Button
                            variant="danger"
                            label="Remove"
                            disabled={!online}
                            onPress={drop}
                            style={{ flex: 1 }}
                        />
                        <Button
                            label={online ? (update.isPending ? "Saving…" : "Save") : "Needs a connection"}
                            disabled={!ready || pending || !online}
                            onPress={save}
                            style={{ flex: 2 }}
                        />
                    </SheetActions>
                </>
            )}
        </Sheet>
    );
}

const makeStyles = (colors: Colors) =>
    StyleSheet.create({
        pending: { minHeight: 196, alignItems: "center", justifyContent: "center" },
        pendingText: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
        pair: { flexDirection: "row", gap: 10 },
        half: { flex: 1 },
        field: { gap: 5 },
        label: { fontFamily: fonts.regular, fontSize: 12, color: colors.quiet },
        dateInput: { justifyContent: "center" },
        dateText: { fontFamily: fonts.regular, fontSize: 15, color: colors.text },
        trade: {
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            paddingVertical: 9,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.hairline,
        },
        tradeMain: { flex: 1, gap: 2 },
        tradeFigures: { alignItems: "flex-end", gap: 2 },
        tradeText: {
            fontFamily: fonts.regular,
            fontSize: 14,
            color: colors.text,
            fontVariant: ["tabular-nums"],
        },
        tradeNote: {
            fontFamily: fonts.regular,
            fontSize: 11,
            color: colors.muted,
            fontVariant: ["tabular-nums"],
        },
        up: { color: colors.accentStrong },
        total: {
            fontFamily: fonts.regular,
            fontSize: 12,
            color: colors.muted,
            fontVariant: ["tabular-nums"],
            marginTop: -space[2],
        },
    });
