import "../session";

import { Geist_400Regular } from "@expo-google-fonts/geist/400Regular";
import { Geist_500Medium } from "@expo-google-fonts/geist/500Medium";
import { Geist_600SemiBold } from "@expo-google-fonts/geist/600SemiBold";
import { useFonts } from "expo-font";
import { useSession } from "@lofit/api";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ToastProvider } from "../components/Toast";
import { CACHE_VERSION, createQueryClient, PERSIST_MAX_AGE_MS, persister } from "../queryClient";
import { useRememberedSignIn } from "../signedIn";
import { colors } from "../theme";

function Routes() {
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
    const [client] = useState(createQueryClient);
    const [fontsLoaded] = useFonts({ Geist_400Regular, Geist_500Medium, Geist_600SemiBold });

    return (
        <GestureHandlerRootView style={styles.root}>
            <SafeAreaProvider>
                <PersistQueryClientProvider
                    client={client}
                    persistOptions={{ persister, maxAge: PERSIST_MAX_AGE_MS, buster: CACHE_VERSION }}
                    onSuccess={() => void client.resumePausedMutations()}
                >
                    <ToastProvider>
                        <StatusBar style="dark" />
                        {fontsLoaded ? <Routes /> : <View style={styles.splash} />}
                    </ToastProvider>
                </PersistQueryClientProvider>
            </SafeAreaProvider>
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    splash: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
});
