import { Picker } from "@react-native-picker/picker";
import { StyleSheet, Text, View } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";
import type { Colors } from "../theme";
import { fonts, useStyles, useTheme } from "../theme";
import { makeFieldStyles } from "./Field";

export type Option<T extends string> = { value: T; label: string };

type DropdownProps<T extends string> = {
    value: T;
    options: readonly Option<T>[];
    onChange: (value: T) => void;
    accessibilityLabel: string;
    style?: StyleProp<ViewStyle>;
};

export function Dropdown<T extends string>({ value, options, onChange, accessibilityLabel, style }: DropdownProps<T>) {
    const { colors } = useTheme();
    return (
        <Picker
            mode="dropdown"
            selectedValue={value}
            onValueChange={(next) => {
                if (next !== value) onChange(next);
            }}
            accessibilityLabel={accessibilityLabel}
            dropdownIconColor={colors.quiet}
            style={[{ color: colors.text }, style]}
        >
            {options.map((option) => (
                <Picker.Item
                    key={option.value}
                    label={option.label}
                    value={option.value}
                    color={colors.text}
                    style={{ backgroundColor: colors.surface, fontSize: 15 }}
                />
            ))}
        </Picker>
    );
}

type Props<T extends string> = Omit<DropdownProps<T>, "accessibilityLabel" | "style"> & {
    label: string;
    hint?: string | undefined;
};

export function Select<T extends string>({ label, hint, ...dropdown }: Props<T>) {
    const styles = useStyles(makeStyles);
    return (
        <View style={styles.field}>
            <Text style={styles.label}>{label}</Text>
            <View style={styles.box}>
                <Dropdown {...dropdown} accessibilityLabel={label} style={styles.picker} />
            </View>
            {hint && <Text style={styles.hint}>{hint}</Text>}
        </View>
    );
}

const makeStyles = (colors: Colors) =>
    StyleSheet.create({
        field: { gap: 5 },
        label: { fontFamily: fonts.regular, fontSize: 12, color: colors.quiet },
        hint: { fontFamily: fonts.regular, fontSize: 11.5, lineHeight: 16, color: colors.muted },
        box: { ...makeFieldStyles(colors).input, paddingHorizontal: 0, justifyContent: "center", overflow: "hidden" },
        picker: { marginHorizontal: -4 },
    });
