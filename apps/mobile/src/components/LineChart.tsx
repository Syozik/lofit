import {
    currencyFormat,
    linePath,
    lineScale,
    nearest,
    tickFormat,
    timeFormats,
    timeTicks,
    valueTicks,
} from "@lofit/view";
import type { LinePoint } from "@lofit/view";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { LayoutChangeEvent } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Svg, { ClipPath, Defs, G, Line, Path, Rect } from "react-native-svg";
import { colors, fonts, radius } from "../theme";

const HEIGHT = 132;
const TIP_EDGE = 0.2;

type Props = {
    points: readonly LinePoint[];
    hover: number | null;
    onHover: (index: number | null) => void;
    guide?: readonly LinePoint[];
    level?: { value: number; label: string };
    marker?: number;
    currency?: string;
};

export function LineChart({
    points,
    hover,
    onHover,
    guide,
    level,
    marker,
    currency = "EUR",
}: Props) {
    const [width, setWidth] = useState(0);

    const scale = lineScale(points, level ? [level.value] : [], width, HEIGHT);
    const { x, y, at, bottom, top, duration } = scale;
    const line = linePath(points, scale);
    const area = `${line}L${width},${HEIGHT}L0,${HEIGHT}Z`;
    const focus = hover === null ? undefined : points[hover];

    const { ticks, step } = valueTicks(bottom, top);
    const formatTick = tickFormat(currency, step);
    const valueFormat = currencyFormat(currency);
    const time = timeFormats(duration);
    const times = timeTicks(scale);

    const track = (pointerX: number) => {
        if (width === 0) return;
        const fraction = Math.min(Math.max(pointerX / width, 0), 1);
        onHover(nearest(points, at(fraction)));
    };

    const scrub = Gesture.Pan()
        .runOnJS(true)
        .activeOffsetX([-4, 4])
        .failOffsetY([-10, 10])
        .onStart((event) => track(event.x))
        .onUpdate((event) => track(event.x))
        .onFinalize(() => onHover(null));
    const tap = Gesture.Tap()
        .runOnJS(true)
        .onEnd((event) => track(event.x));

    const focusFraction = focus && width > 0 ? x(focus.t) / width : 0;

    return (
        <View>
            <GestureDetector gesture={Gesture.Exclusive(scrub, tap)}>
                <View
                    style={styles.plot}
                    onLayout={(event: LayoutChangeEvent) =>
                        setWidth(event.nativeEvent.layout.width)
                    }
                >
                    {width > 0 && (
                        <Svg width={width} height={HEIGHT}>
                            <Defs>
                                <ClipPath id="plot">
                                    <Rect x={0} y={0} width={width} height={HEIGHT} />
                                </ClipPath>
                            </Defs>
                            <Path d={area} fill="rgba(63, 102, 207, 0.09)" />
                            {level && (
                                <Line
                                    x1={0}
                                    x2={width}
                                    y1={y(level.value)}
                                    y2={y(level.value)}
                                    stroke={colors.subtle}
                                    strokeWidth={1}
                                    strokeDasharray="4 3"
                                />
                            )}
                            {guide && guide.length > 1 && (
                                <G clipPath="url(#plot)">
                                    <Path
                                        d={linePath(guide, scale)}
                                        fill="none"
                                        stroke={colors.subtle}
                                        strokeWidth={1.25}
                                        strokeDasharray="4 3"
                                    />
                                </G>
                            )}
                            {marker !== undefined && (
                                <Line
                                    x1={x(marker)}
                                    x2={x(marker)}
                                    y1={0}
                                    y2={HEIGHT}
                                    stroke={colors.divider}
                                    strokeWidth={1}
                                    strokeDasharray="2 3"
                                />
                            )}
                            <Path
                                d={line}
                                fill="none"
                                stroke={colors.accent}
                                strokeWidth={2}
                                strokeLinejoin="round"
                            />
                            {focus && (
                                <Line
                                    x1={x(focus.t)}
                                    x2={x(focus.t)}
                                    y1={0}
                                    y2={HEIGHT}
                                    stroke={colors.subtle}
                                    strokeWidth={1}
                                />
                            )}
                        </Svg>
                    )}

                    {width > 0 &&
                        ticks.map((tick) => (
                            <Text
                                key={tick}
                                style={[styles.tick, { top: y(tick) - 7 }]}
                                pointerEvents="none"
                            >
                                {formatTick(tick)}
                            </Text>
                        ))}
                    {level && width > 0 && (
                        <Text
                            style={[styles.levelLabel, { top: y(level.value) - 16 }]}
                            pointerEvents="none"
                        >
                            {level.label}
                        </Text>
                    )}
                    {focus && (
                        <View
                            pointerEvents="none"
                            style={[
                                styles.dot,
                                { left: x(focus.t) - 4.5, top: y(focus.value) - 4.5 },
                            ]}
                        />
                    )}
                    {focus && (
                        <View
                            pointerEvents="none"
                            style={[
                                styles.tip,
                                focusFraction < TIP_EDGE
                                    ? { left: 0 }
                                    : focusFraction > 1 - TIP_EDGE
                                      ? { right: 0 }
                                      : { left: x(focus.t) - 60, width: 120 },
                            ]}
                        >
                            <Text style={styles.tipValue}>
                                {valueFormat.format(focus.value / 100)}
                            </Text>
                            <Text style={styles.tipTime}>{time.full(focus.t)}</Text>
                        </View>
                    )}
                </View>
            </GestureDetector>

            <View style={styles.axis}>
                {width > 0 &&
                    times.map((tick, index) => (
                        <Text
                            key={tick.t}
                            style={[
                                styles.axisText,
                                index === 0
                                    ? { left: 0 }
                                    : index === times.length - 1
                                      ? { right: 0 }
                                      : {
                                            left: tick.fraction * width - 40,
                                            width: 80,
                                            textAlign: "center",
                                        },
                            ]}
                        >
                            {tick.label}
                        </Text>
                    ))}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    plot: { height: HEIGHT },
    tick: {
        position: "absolute",
        left: 0,
        paddingHorizontal: 3,
        borderRadius: 3,
        backgroundColor: "rgba(253, 253, 255, 0.8)",
        fontFamily: fonts.regular,
        fontSize: 10,
        color: colors.muted,
        fontVariant: ["tabular-nums"],
    },
    levelLabel: {
        position: "absolute",
        right: 0,
        paddingHorizontal: 3,
        backgroundColor: "rgba(253, 253, 255, 0.85)",
        fontFamily: fonts.regular,
        fontSize: 10.5,
        color: colors.subtle,
    },
    dot: {
        position: "absolute",
        width: 9,
        height: 9,
        borderRadius: 4.5,
        backgroundColor: colors.accent,
        borderWidth: 2,
        borderColor: colors.surface,
    },
    tip: {
        position: "absolute",
        top: 2,
        alignItems: "center",
        paddingVertical: 3,
        paddingHorizontal: 7,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.divider,
        backgroundColor: colors.surface,
    },
    tipValue: {
        fontFamily: fonts.medium,
        fontSize: 12,
        color: colors.text,
        fontVariant: ["tabular-nums"],
    },
    tipTime: { fontFamily: fonts.regular, fontSize: 10.5, color: colors.muted },
    axis: { height: 16, marginTop: 4 },
    axisText: {
        position: "absolute",
        top: 0,
        fontFamily: fonts.regular,
        fontSize: 10.5,
        color: colors.muted,
        fontVariant: ["tabular-nums"],
    },
});
