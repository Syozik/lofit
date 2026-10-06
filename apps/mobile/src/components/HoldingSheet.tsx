import { useDeleteHolding, useHoldingHistory, useSellHolding, useUpdateHolding } from "@lofit/api";
import { euros, formatAmount, formatEuros, holdingValue, unitCost } from "@lofit/domain";
import type { Holding } from "@lofit/domain";
import { dayFormat, inCurrency, parsePositive } from "@lofit/view";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fonts, space } from "../theme";
import { Button } from "./Button";
import { Segmented } from "./Choices";
import { Field, fieldStyles } from "./Field";
import { PriceChart } from "./PriceChart";
import { pickDay } from "./RangePicker";
import { Sheet, SheetActions } from "./Sheet";
import { useToast } from "./Toast";

type Mode = "correct" | "sell";

const MODES = [
    { value: "correct", label: "Correct" },
    { value: "sell", label: "Sell" },
] as const;

const today = () => new Date().toISOString().slice(0, 10);

type Props = {
    holding: Holding;
    accountName: string;
    onClose: () => void;
};

export function HoldingSheet({ holding, accountName, onClose }: Props) {
    const update = useUpdateHolding();
    const sell = useSellHolding();
    const remove = useDeleteHolding();
    const history = useHoldingHistory(holding.id);
    const show = useToast();

    const [mode, setMode] = useState<Mode>("correct");
    const [quantity, setQuantity] = useState(String(holding.quantity));
    const [paid, setPaid] = useState((holding.cost / 100).toFixed(2));
    const [units, setUnits] = useState("");
    const [price, setPrice] = useState((holding.nativePrice / 100).toFixed(2));
    const [since, setSince] = useState(holding.heldSince);

    const pending = update.isPending || sell.isPending || remove.isPending;
    const held = parsePositive(quantity);
    const cost = parsePositive(paid);
    const sold = parsePositive(units);
    const at = parsePositive(price);
    const proceeds = sold && at ? sold * at : 0;

    function save() {
        if (!held || cost === undefined || !since || pending) return;
        update.mutate(
            { id: holding.id, quantity: held, cost: euros(cost), heldSince: since },
            {
                onSuccess: () => {
                    show(`Updated ${holding.symbol}`);
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
                    show(`Sold ${result.sold} ${holding.symbol} into ${accountName}`);
                    onClose();
                },
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
            note={`${holding.name} · ${accountName} · worth ${formatEuros(holdingValue(holding))} · since ${dayFormat.format(new Date(holding.heldSince))}`}
            onClose={onClose}
        >
            {holding.quote &&
                (history.data && history.data.points.length > 1 ? (
                    <PriceChart
                        points={history.data.points}
                        currency={history.data.currency}
                        cost={
                            holding.cost > 0
                                ? unitCost(holding, history.data.perEuroWhenBought)
                                : undefined
                        }
                        heldSince={holding.heldSince}
                    />
                ) : (
                    <View style={styles.pending}>
                        <Text style={styles.pendingText}>
                            {history.isPending
                                ? "Loading prices…"
                                : "No price history for this symbol"}
                        </Text>
                    </View>
                ))}

            <Segmented options={MODES} value={mode} onChange={setMode} />

            {mode === "sell" ? (
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
                            ? `€ ${formatAmount(euros(proceeds))} into ${accountName}`
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
                            label={sell.isPending ? "Selling…" : "Sell"}
                            disabled={!sold || !at || pending}
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
                            onPress={drop}
                            style={{ flex: 1 }}
                        />
                        <Button
                            label={update.isPending ? "Saving…" : "Save"}
                            disabled={!held || cost === undefined || !since || pending}
                            onPress={save}
                            style={{ flex: 2 }}
                        />
                    </SheetActions>
                </>
            )}
        </Sheet>
    );
}

const styles = StyleSheet.create({
    pending: { minHeight: 196, alignItems: "center", justifyContent: "center" },
    pendingText: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
    pair: { flexDirection: "row", gap: 10 },
    half: { flex: 1 },
    field: { gap: 5 },
    label: { fontFamily: fonts.regular, fontSize: 12, color: colors.quiet },
    dateInput: { justifyContent: "center" },
    dateText: { fontFamily: fonts.regular, fontSize: 15, color: colors.text },
    total: {
        fontFamily: fonts.regular,
        fontSize: 12,
        color: colors.muted,
        fontVariant: ["tabular-nums"],
        marginTop: -space[2],
    },
});
