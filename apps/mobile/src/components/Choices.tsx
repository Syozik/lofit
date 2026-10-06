import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { GestureResponderEvent } from "react-native";
import { colors, fonts, radius } from "../theme";

type Option<T extends string> = { value: T; label: string };

type SegmentedProps<T extends string> = {
    options: readonly Option<T>[];
    value: T;
    onChange: (value: T) => void;
};

export function Segmented<T extends string>({ options, value, onChange }: SegmentedProps<T>) {
    return (
        <View style={styles.seg}>
            {options.map((option) => (
                <Pressable
                    key={option.value}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: value === option.value }}
                    onPress={() => onChange(option.value)}
                    style={[styles.segOpt, value === option.value && styles.segOn]}
                >
                    <Text style={[styles.segText, value === option.value && styles.segTextOn]}>
                        {option.label}
                    </Text>
                </Pressable>
            ))}
        </View>
    );
}

type ChipProps = {
    label: string;
    selected?: boolean;
    strong?: boolean;
    onPress: (event: GestureResponderEvent) => void;
};

export function Chip({ label, selected = false, strong = false, onPress }: ChipProps) {
    return (
        <Pressable
            onPress={onPress}
            style={[styles.chip, selected && styles.chipOn, strong && styles.chipStrong]}
        >
            <Text
                style={[
                    styles.chipText,
                    selected && styles.chipTextOn,
                    strong && styles.chipTextStrong,
                ]}
            >
                {label}
            </Text>
        </Pressable>
    );
}

export function ChipRow({
    children,
    scroll = false,
}: {
    children: React.ReactNode;
    scroll?: boolean;
}) {
    if (scroll) {
        return (
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipRow}
            >
                {children}
            </ScrollView>
        );
    }
    return <View style={[styles.chipRow, styles.wrap]}>{children}</View>;
}

const styles = StyleSheet.create({
    seg: {
        flexDirection: "row",
        alignSelf: "flex-start",
        borderWidth: 1,
        borderColor: colors.divider,
        borderRadius: radius.md,
        overflow: "hidden",
    },
    segOpt: { paddingVertical: 6, paddingHorizontal: 12 },
    segOn: { backgroundColor: colors.accentSoft },
    segText: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.quiet },
    segTextOn: { color: colors.accentInk, fontFamily: fonts.medium },
    chipRow: { flexDirection: "row", gap: 6, alignItems: "center" },
    wrap: { flexWrap: "wrap" },
    chip: {
        paddingVertical: 5,
        paddingHorizontal: 11,
        borderRadius: radius.md * 0.75,
        borderWidth: 1,
        borderColor: colors.divider,
    },
    chipOn: { backgroundColor: colors.accentSoft, borderColor: colors.accentSoft },
    chipStrong: { backgroundColor: colors.accentStrong, borderColor: colors.accentStrong },
    chipText: { fontFamily: fonts.regular, fontSize: 12, color: colors.quiet },
    chipTextOn: { color: colors.accentInk },
    chipTextStrong: { color: "#ffffff" },
});
