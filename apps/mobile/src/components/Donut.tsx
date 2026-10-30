import { formatMoney } from "@lofit/domain";
import { DIMMED_COLOR, toSegments } from "@lofit/view";
import type { Slice } from "@lofit/view";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import type { Colors } from "../theme";
import { fonts, useStyles, useTheme } from "../theme";

const SIZE = 152;
const RING = 26;
const RADIUS = (SIZE - RING) / 2;
const CENTRE = SIZE / 2;

function point(deg: number): { x: number; y: number } {
    const radians = ((deg - 90) * Math.PI) / 180;
    return { x: CENTRE + RADIUS * Math.cos(radians), y: CENTRE + RADIUS * Math.sin(radians) };
}

function arc(from: number, to: number): string {
    const start = point(from);
    const end = point(to);
    const large = to - from > 180 ? 1 : 0;
    return `M ${start.x} ${start.y} A ${RADIUS} ${RADIUS} 0 ${large} 1 ${end.x} ${end.y}`;
}

type Props = {
    slices: readonly Slice[];
    focused: string | null;
    onFocus: (key: string | null) => void;
    label: string;
    value: string;
    lit?: ReadonlySet<string> | undefined;
};

export function Donut({ slices, focused, onFocus, label, value, lit }: Props) {
    const { tokenColor } = useTheme();
    const styles = useStyles(makeStyles);
    const segments = toSegments(slices);
    const on = (key: string) => (lit ? lit.has(key) : !focused || key === focused);
    const paint = (key: string, color: Slice["color"]) => tokenColor(on(key) ? color : DIMMED_COLOR);

    return (
        <View style={styles.composition}>
            <View style={styles.donut}>
                <Svg width={SIZE} height={SIZE}>
                    {segments.map((segment) =>
                        segment.to - segment.from >= 359.99 ? (
                            <Circle
                                key={segment.key}
                                cx={CENTRE}
                                cy={CENTRE}
                                r={RADIUS}
                                stroke={paint(segment.key, segment.color)}
                                strokeWidth={RING}
                                fill="none"
                            />
                        ) : (
                            <Path
                                key={segment.key}
                                d={arc(segment.from, segment.to)}
                                stroke={paint(segment.key, segment.color)}
                                strokeWidth={RING}
                                fill="none"
                            />
                        ),
                    )}
                </Svg>
                <View style={styles.hole} pointerEvents="none">
                    <Text style={styles.holeLabel} numberOfLines={1}>
                        {label}
                    </Text>
                    <Text style={styles.holeValue} numberOfLines={1} adjustsFontSizeToFit>
                        {value}
                    </Text>
                </View>
            </View>

            <View style={styles.legend}>
                {segments.map((segment) => (
                    <Pressable
                        key={segment.key}
                        accessibilityRole="button"
                        accessibilityState={{ selected: lit ? lit.has(segment.key) : focused === segment.key }}
                        onPress={() => onFocus(focused === segment.key ? null : segment.key)}
                        style={[styles.item, on(segment.key) ? null : styles.dimmed]}
                    >
                        <View style={styles.itemHead}>
                            <View style={[styles.dot, { backgroundColor: tokenColor(segment.color) }]} />
                            <Text style={styles.name} numberOfLines={1}>
                                {segment.label}
                            </Text>
                            <Text style={styles.share}>{segment.share}%</Text>
                        </View>
                        <Text style={[styles.value, segment.value < 0 ? styles.negative : null]}>
                            {formatMoney(segment.value)}
                        </Text>
                    </Pressable>
                ))}
            </View>
        </View>
    );
}

const makeStyles = (colors: Colors) =>
    StyleSheet.create({
        composition: { flexDirection: "row", alignItems: "center", gap: 20, paddingVertical: 6 },
        donut: { width: SIZE, height: SIZE },
        hole: {
            position: "absolute",
            top: RING,
            left: RING,
            right: RING,
            bottom: RING,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 8,
        },
        holeLabel: { fontFamily: fonts.medium, fontSize: 9, letterSpacing: 0.9, textTransform: "uppercase", color: colors.muted },
        holeValue: { fontFamily: fonts.medium, fontSize: 17, color: colors.text, fontVariant: ["tabular-nums"] },
        legend: { flex: 1, minWidth: 0, gap: 11, justifyContent: "center", minHeight: SIZE },
        item: { gap: 2 },
        dimmed: { opacity: 0.4 },
        itemHead: { flexDirection: "row", alignItems: "center", gap: 8 },
        dot: { width: 6, height: 6, borderRadius: 3 },
        name: { flex: 1, fontFamily: fonts.regular, fontSize: 12, color: colors.quiet },
        share: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted },
        value: { fontFamily: fonts.regular, fontSize: 14, color: colors.text, paddingLeft: 14, fontVariant: ["tabular-nums"] },
        negative: { color: colors.quiet },
    });
