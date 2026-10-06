import type { ReactNode } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, fonts, space } from "../theme";
import { AppHeader } from "./AppHeader";

type Props = {
    children: ReactNode;
    refreshing?: boolean;
    onRefresh?: () => void;
};

export function Screen({ children, refreshing = false, onRefresh }: Props) {
    return (
        <SafeAreaView style={styles.screen} edges={["top"]}>
            <ScrollView
                contentContainerStyle={styles.content}
                refreshControl={
                    onRefresh ? (
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} />
                    ) : undefined
                }
            >
                <AppHeader />
                {children}
            </ScrollView>
        </SafeAreaView>
    );
}

export function Status({ text, busy = false }: { text: string; busy?: boolean }) {
    return (
        <View style={styles.status}>
            {busy && <ActivityIndicator color={colors.accent} />}
            <Text style={styles.statusText}>{text}</Text>
        </View>
    );
}

export const text = StyleSheet.create({
    kicker: {
        fontFamily: fonts.medium,
        fontSize: 10.5,
        letterSpacing: 1.2,
        textTransform: "uppercase",
        color: colors.muted,
    },
    body: { fontFamily: fonts.regular, fontSize: 14, color: colors.text },
    muted: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
});

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    content: { paddingHorizontal: 20, paddingBottom: 40, gap: space[8] },
    status: { paddingVertical: 60, alignItems: "center", gap: 10 },
    statusText: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
});
