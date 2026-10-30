import { CURRENCIES, currencyLabel } from "@lofit/domain";
import type { Currency } from "@lofit/domain";
import { Check, ChevronDown } from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Colors } from "../theme";
import { fonts, radius, useStyles, useTheme } from "../theme";
import { makeFieldStyles } from "./Field";

type ListProps = {
    value: Currency;
    onPick: (currency: Currency) => void;
};

export function CurrencyList({ value, onPick }: ListProps) {
    const { colors } = useTheme();
    const styles = useStyles(makeStyles);
    return (
        <View style={styles.list} accessibilityRole="radiogroup">
            {CURRENCIES.map((currency, index) => (
                <Pressable
                    key={currency}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: currency === value }}
                    onPress={() => onPick(currency)}
                    style={({ pressed }) => [styles.option, index > 0 && styles.divided, pressed && styles.pressed]}
                >
                    <Text style={styles.code}>{currencyLabel(currency)}</Text>
                    {currency === value && <Check size={16} color={colors.accent} />}
                </Pressable>
            ))}
        </View>
    );
}

type Props = {
    value: Currency;
    onChange: (currency: Currency) => void;
    hint?: string | undefined;
};

export function CurrencyPicker({ value, onChange, hint }: Props) {
    const { colors } = useTheme();
    const styles = useStyles(makeStyles);
    const [open, setOpen] = useState(false);
    return (
        <View style={styles.field}>
            <Text style={styles.label}>Currency</Text>
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Currency ${value}, change`}
                onPress={() => setOpen((shown) => !shown)}
                style={styles.trigger}
            >
                <Text style={styles.code}>{currencyLabel(value)}</Text>
                <ChevronDown size={16} color={colors.quiet} />
            </Pressable>
            {open && (
                <CurrencyList
                    value={value}
                    onPick={(currency) => {
                        setOpen(false);
                        if (currency !== value) onChange(currency);
                    }}
                />
            )}
            {hint && <Text style={styles.hint}>{hint}</Text>}
        </View>
    );
}

const makeStyles = (colors: Colors) =>
    StyleSheet.create({
        field: { gap: 5 },
        label: { fontFamily: fonts.regular, fontSize: 12, color: colors.quiet },
        hint: { fontFamily: fonts.regular, fontSize: 11.5, lineHeight: 16, color: colors.muted },
        trigger: {
            ...makeFieldStyles(colors).input,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
        },
        list: {
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.divider,
            borderRadius: radius.md,
            overflow: "hidden",
        },
        option: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, minHeight: 42 },
        divided: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider },
        pressed: { backgroundColor: colors.accentFill },
        code: { flex: 1, fontFamily: fonts.regular, fontSize: 14, color: colors.text },
    });
