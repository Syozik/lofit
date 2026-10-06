import { signOut } from "@lofit/api";
import { useQueryClient } from "@tanstack/react-query";
import { useNetworkState } from "expo-network";
import { LogOut } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fonts } from "../theme";

export function AppHeader() {
    const client = useQueryClient();
    const network = useNetworkState();
    const online = network.isConnected !== false && network.isInternetReachable !== false;

    async function leave() {
        await signOut();
        client.clear();
    }

    return (
        <View style={styles.header}>
            <Text style={styles.wordmark}>lofit</Text>
            <View
                accessibilityLabel={online ? "Online" : "Offline"}
                style={[
                    styles.indicator,
                    { backgroundColor: online ? colors.accent : colors.subtle },
                ]}
            />
            <Pressable
                accessibilityLabel="Sign out"
                hitSlop={10}
                onPress={() => void leave()}
                style={styles.action}
            >
                <LogOut size={16} strokeWidth={1.5} color={colors.quiet} />
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    header: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 10 },
    indicator: { width: 5, height: 5, borderRadius: 2.5, marginTop: 2 },
    wordmark: { fontFamily: fonts.semibold, fontSize: 20, color: colors.text, letterSpacing: -0.4 },
    action: { marginLeft: "auto", padding: 6 },
});
