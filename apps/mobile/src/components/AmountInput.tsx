import { StyleSheet, Text, TextInput, View } from "react-native";
import { colors, fonts } from "../theme";

type Props = {
    value: string;
    onChange: (value: string) => void;
    label: string;
    autoFocus?: boolean;
    prefix?: string;
};

export function AmountInput({ value, onChange, label, autoFocus = false, prefix = "€" }: Props) {
    return (
        <View style={styles.amount}>
            {prefix !== "" && <Text style={styles.currency}>{prefix}</Text>}
            <TextInput
                accessibilityLabel={label}
                style={styles.input}
                value={value}
                onChangeText={onChange}
                placeholder="0.00"
                placeholderTextColor={colors.chip}
                keyboardType="numbers-and-punctuation"
                autoComplete="off"
                importantForAutofill="no"
                autoFocus={autoFocus}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    amount: { flexDirection: "row", alignItems: "center", gap: 8 },
    currency: { fontFamily: fonts.medium, fontSize: 26, color: colors.subtle },
    input: {
        flex: 1,
        padding: 0,
        fontFamily: fonts.medium,
        fontSize: 40,
        letterSpacing: -1,
        color: colors.text,
        fontVariant: ["tabular-nums"],
    },
});
