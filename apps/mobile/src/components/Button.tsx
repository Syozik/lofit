import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";
import type { Colors } from "../theme";
import { fonts, radius, useStyles } from "../theme";

type Props = {
    label: string;
    onPress: () => void;
    variant?: "primary" | "secondary" | "ghost" | "danger";
    disabled?: boolean;
    icon?: ReactNode;
    style?: StyleProp<ViewStyle>;
};

export function Button({ label, onPress, variant = "primary", disabled = false, icon, style }: Props) {
    const styles = useStyles(makeStyles);
    const labels = useStyles(makeLabels);
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

const makeStyles = (colors: Colors) =>
    StyleSheet.create({
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
            borderColor: colors.dangerEdge,
        },
        dim: { opacity: 0.55 },
        label: { fontFamily: fonts.medium, fontSize: 14 },
    });

const makeLabels = (colors: Colors) =>
    StyleSheet.create({
        primary: { color: colors.onAccent },
        secondary: { color: colors.text },
        ghost: { color: colors.accent },
        danger: { color: colors.danger },
    });
