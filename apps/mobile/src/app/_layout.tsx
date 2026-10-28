import "../session";

import { Geist_400Regular } from "@expo-google-fonts/geist/400Regular";
import { Geist_500Medium } from "@expo-google-fonts/geist/500Medium";
import { Geist_600SemiBold } from "@expo-google-fonts/geist/600SemiBold";
import { useFonts } from "expo-font";
import { useSession } from "@lofit/api";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import type { Theme } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ToastProvider } from "../components/Toast";
import { CACHE_VERSION, createQueryClient, PERSIST_MAX_AGE_MS, persister } from "../queryClient";
import { useRememberedSignIn } from "../signedIn";
import type { Colors } from "../theme";
import { useStyles, useTheme } from "../theme";

function Routes() {
    const { colors } = useTheme();
    const styles = useStyles(makeStyles);
    const session = useSession();
    const known = session.isPending ? null : session.error ? null : Boolean(session.data);
    const remembered = useRememberedSignIn(known);

    if (session.isPending) {
        return (
            <View style={styles.splash}>
                <ActivityIndicator color={colors.accent} />
            </View>
        );
    }

    const signedIn = Boolean(session.data) || (Boolean(session.error) && remembered);

    return (
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
            <Stack.Protected guard={signedIn}>
                <Stack.Screen name="(tabs)" />
            </Stack.Protected>
            <Stack.Protected guard={!signedIn}>
                <Stack.Screen name="sign-in" />
            </Stack.Protected>
        </Stack>
    );
}

export default function RootLayout() {
    const { scheme, colors } = useTheme();
    const styles = useStyles(makeStyles);
    const [client] = useState(createQueryClient);
    const [fontsLoaded] = useFonts({ Geist_400Regular, Geist_500Medium, Geist_600SemiBold });
    const navigationTheme = useMemo<Theme>(() => {
        const base = scheme === "dark" ? DarkTheme : DefaultTheme;
        return {
            ...base,
            colors: {
                ...base.colors,
                primary: colors.accent,
                background: colors.bg,
                card: colors.surface,
                text: colors.text,
                border: colors.divider,
                notification: colors.danger,
            },
        };
    }, [scheme, colors]);

    useEffect(() => {
        void SystemUI.setBackgroundColorAsync(colors.bg);
    }, [colors.bg]);

    return (
        <GestureHandlerRootView style={styles.root}>
            <SafeAreaProvider>
                <PersistQueryClientProvider
                    client={client}
                    persistOptions={{ persister, maxAge: PERSIST_MAX_AGE_MS, buster: CACHE_VERSION }}
                    onSuccess={() => void client.resumePausedMutations()}
                >
                    <ThemeProvider value={navigationTheme}>
                        <ToastProvider>
                            <StatusBar style="auto" />
                            {fontsLoaded ? <Routes /> : <View style={styles.splash} />}
                        </ToastProvider>
                    </ThemeProvider>
                </PersistQueryClientProvider>
            </SafeAreaProvider>
        </GestureHandlerRootView>
    );
}

const makeStyles = (colors: Colors) =>
    StyleSheet.create({
        root: { flex: 1, backgroundColor: colors.bg },
        splash: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
    });
