import type { ReactNode } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import type { TextInputProps } from "react-native";
import type { Colors } from "../theme";
import { fonts, radius, useStyles, useTheme } from "../theme";

type Props = TextInputProps & {
    label: string;
    trailing?: ReactNode;
    hint?: string | undefined;
};

export function Field({ label, trailing, hint, style, ...input }: Props) {
    const { colors } = useTheme();
    const styles = useStyles(makeStyles);
    return (
        <View style={styles.field}>
            <Text style={styles.label}>{label}</Text>
            <View style={styles.wrap}>
                <TextInput
                    placeholderTextColor={colors.subtle}
                    autoComplete="off"
                    importantForAutofill="no"
                    style={[styles.input, trailing ? styles.withTrailing : null, style]}
                    {...input}
                />
                {trailing && <View style={styles.trailing}>{trailing}</View>}
            </View>
            {hint && <Text style={styles.hint}>{hint}</Text>}
        </View>
    );
}

export const makeFieldStyles = (colors: Colors) =>
    StyleSheet.create({
        input: {
            minHeight: 42,
            paddingHorizontal: 12,
            fontFamily: fonts.regular,
            fontSize: 15,
            color: colors.text,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.divider,
            borderRadius: radius.md,
        },
    });

const makeStyles = (colors: Colors) =>
    StyleSheet.create({
        field: { gap: 5 },
        label: { fontFamily: fonts.regular, fontSize: 12, color: colors.quiet },
        wrap: { justifyContent: "center" },
        input: makeFieldStyles(colors).input,
        withTrailing: { paddingRight: 44 },
        trailing: { position: "absolute", right: 0, top: 0, bottom: 0, width: 44, alignItems: "center", justifyContent: "center" },
        hint: { fontFamily: fonts.regular, fontSize: 11.5, color: colors.muted },
    });
