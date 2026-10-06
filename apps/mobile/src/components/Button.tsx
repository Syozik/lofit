import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";
import { colors, fonts, radius } from "../theme";

type Props = {
    label: string;
    onPress: () => void;
    variant?: "primary" | "secondary" | "ghost" | "danger";
    disabled?: boolean;
    icon?: ReactNode;
    style?: StyleProp<ViewStyle>;
};

export function Button({ label, onPress, variant = "primary", disabled = false, icon, style }: Props) {
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled }}
            disabled={disabled}
            onPress={onPress}
            style={({ pressed }) => [
                styles.base,
                styles[variant],
                (pressed || disabled) && styles.dim,
                style,
            ]}
        >
            {icon}
            <Text style={[styles.label, labels[variant]]}>{label}</Text>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    base: {
        minHeight: 42,
        paddingHorizontal: 16,
        borderRadius: radius.md,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
    },
    primary: { backgroundColor: colors.accent },
    secondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.divider },
    ghost: { backgroundColor: "transparent" },
    danger: {
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: "rgba(209, 69, 59, 0.35)",
    },
    dim: { opacity: 0.55 },
    label: { fontFamily: fonts.medium, fontSize: 14 },
});

const labels = StyleSheet.create({
    primary: { color: "#ffffff" },
    secondary: { color: colors.text },
    ghost: { color: colors.accent },
    danger: { color: colors.danger },
});
