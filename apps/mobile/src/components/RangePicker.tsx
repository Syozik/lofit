import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { HISTORY_RANGE_LABELS } from "@lofit/domain";
import type { DayWindow, HistoryRange } from "@lofit/domain";
import { dayFormat } from "@lofit/view";
import { useEffect, useRef } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text } from "react-native";
import type { Colors } from "../theme";
import { fonts, radius, useStyles } from "../theme";
import { Chip } from "./Choices";

function toDate(day: string): Date {
    return new Date(`${day}T00:00:00Z`);
}

function toDay(date: Date): string {
    return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
        .toISOString()
        .slice(0, 10);
}

export function pickDay(
    current: string,
    onPick: (day: string) => void,
    bounds: { min?: string; max?: string } = {},
) {
    if (Platform.OS !== "android") return;
    DateTimePickerAndroid.open({
        value: toDate(current),
        mode: "date",
        ...(bounds.min ? { minimumDate: toDate(bounds.min) } : {}),
        ...(bounds.max ? { maximumDate: toDate(bounds.max) } : {}),
        onValueChange: (event, date) => {
            onPick(toDay(date));
        },
    });
}

type Props = {
    ranges: readonly HistoryRange[];
    active: HistoryRange;
    onSelect: (range: HistoryRange) => void;
    custom: DayWindow;
    onCustom: (window: DayWindow) => void;
    bounds: DayWindow;
};

export function RangePicker({ ranges, active, onSelect, custom, onCustom, bounds }: Props) {
    const styles = useStyles(makeStyles);
    const row = useRef<ScrollView>(null);

    useEffect(() => {
        if (active === "custom") row.current?.scrollToEnd({ animated: true });
    }, [active]);

    return (
        <ScrollView
            ref={row}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.row}
        >
            {ranges.map((option) => (
                <Chip
                    key={option}
                    label={HISTORY_RANGE_LABELS[option]}
                    selected={active === option}
                    onPress={() => onSelect(option)}
                />
            ))}
            {active === "custom" && (
                <>
                    <Pressable
                        style={styles.date}
                        onPress={() =>
                            pickDay(custom.from, (from) => onCustom({ ...custom, from }), {
                                min: bounds.from,
                                max: custom.to,
                            })
                        }
                    >
                        <Text style={styles.dateText}>{dayFormat.format(toDate(custom.from))}</Text>
                    </Pressable>
                    <Text style={styles.to}>–</Text>
                    <Pressable
                        style={styles.date}
                        onPress={() =>
                            pickDay(custom.to, (to) => onCustom({ ...custom, to }), {
                                min: custom.from,
                                max: bounds.to,
                            })
                        }
                    >
                        <Text style={styles.dateText}>{dayFormat.format(toDate(custom.to))}</Text>
                    </Pressable>
                </>
            )}
        </ScrollView>
    );
}

const makeStyles = (colors: Colors) =>
    StyleSheet.create({
        row: { flexDirection: "row", alignItems: "center", gap: 6 },
        date: {
            paddingVertical: 5,
            paddingHorizontal: 8,
            borderRadius: radius.md * 0.75,
            borderWidth: 1,
            borderColor: colors.divider,
        },
        dateText: {
            fontFamily: fonts.regular,
            fontSize: 11.5,
            color: colors.text,
            fontVariant: ["tabular-nums"],
        },
        to: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted },
    });
