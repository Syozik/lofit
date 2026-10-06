import { signOut } from "@lofit/api";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fonts } from "../theme";

export function AppHeader() {
    const client = useQueryClient();

    async function leave() {
        await signOut();
        client.clear();
    }

    return (
        <View style={styles.header}>
            <Text style={styles.wordmark}>lofit</Text>
            <Pressable accessibilityLabel="Sign out" hitSlop={10} onPress={() => void leave()} style={styles.action}>
                <LogOut size={16} strokeWidth={1.5} color={colors.quiet} />
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    header: { flexDirection: "row", alignItems: "center", paddingVertical: 10 },
    wordmark: { fontFamily: fonts.semibold, fontSize: 20, color: colors.text, letterSpacing: -0.4 },
    action: { marginLeft: "auto", padding: 6 },
});
