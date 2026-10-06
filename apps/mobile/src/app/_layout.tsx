import "../session";

import { Geist_400Regular } from "@expo-google-fonts/geist/400Regular";
import { Geist_500Medium } from "@expo-google-fonts/geist/500Medium";
import { Geist_600SemiBold } from "@expo-google-fonts/geist/600SemiBold";
import { useFonts } from "expo-font";
import { useSession } from "@lofit/api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ToastProvider } from "../components/Toast";
import { colors } from "../theme";

function Routes() {
    const session = useSession();

    if (session.isPending) {
        return (
            <View style={styles.splash}>
                <ActivityIndicator color={colors.accent} />
            </View>
        );
    }

    const signedIn = Boolean(session.data);

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
    const [client] = useState(() => new QueryClient());
    const [fontsLoaded] = useFonts({ Geist_400Regular, Geist_500Medium, Geist_600SemiBold });

    return (
        <GestureHandlerRootView style={styles.root}>
            <SafeAreaProvider>
                <QueryClientProvider client={client}>
                    <ToastProvider>
                        <StatusBar style="dark" />
                        {fontsLoaded ? <Routes /> : <View style={styles.splash} />}
                    </ToastProvider>
                </QueryClientProvider>
            </SafeAreaProvider>
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    splash: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
});
