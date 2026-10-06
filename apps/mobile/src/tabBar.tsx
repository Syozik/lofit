import { BlurTargetView, BlurView } from "expo-blur";
import { useFocusEffect } from "expo-router";
import type { ReactNode, RefObject } from "react";
import { createContext, useCallback, useContext, useId, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { colors } from "./theme";

export const TAB_BAR_HEIGHT = 58;

export function useTabBarSpace(): number {
    return useSafeAreaInsets().bottom + TAB_BAR_HEIGHT;
}

type Target = { id: string; ref: RefObject<View | null> };

type Targets = { current: Target | null; show: (target: Target) => void };

const BlurTargets = createContext<Targets>({ current: null, show: () => {} });

export function BlurTargetsProvider({ children }: { children: ReactNode }) {
    const [current, setCurrent] = useState<Target | null>(null);
    return <BlurTargets.Provider value={{ current, show: setCurrent }}>{children}</BlurTargets.Provider>;
}

export function BlurSource({ children }: { children: ReactNode }) {
    const id = useId();
    const ref = useRef<View | null>(null);
    const { show } = useContext(BlurTargets);

    useFocusEffect(
        useCallback(() => {
            show({ id, ref });
        }, [id, show]),
    );

    return (
        <BlurTargetView ref={ref} style={styles.fill}>
            {children}
        </BlurTargetView>
    );
}

export function TabBarBackground() {
    const { current } = useContext(BlurTargets);

    return (
        <View style={StyleSheet.absoluteFill}>
            {current && (
                <BlurView
                    key={current.id}
                    blurTarget={current.ref}
                    blurMethod="dimezisBlurView"
                    intensity={8}
                    tint="light"
                    style={StyleSheet.absoluteFill}
                />
            )}
            <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none">
                <Defs>
                    <LinearGradient id="wash" x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0" stopColor={colors.bg} stopOpacity={0.45} />
                        <Stop offset="0.4" stopColor={colors.bg} stopOpacity={1} />
                        <Stop offset="1" stopColor={colors.bg} stopOpacity={1} />
                    </LinearGradient>
                </Defs>
                <Rect x="0" y="0" width="100%" height="100%" fill="url(#wash)" />
            </Svg>
        </View>
    );
}

const styles = StyleSheet.create({
    fill: { flex: 1 },
});
