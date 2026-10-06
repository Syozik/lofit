import { signOut } from "@lofit/api";
import { useMutationState, useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useOnline } from "../connectivity";
import { persister } from "../queryClient";
import { forgetSignIn } from "../signedIn";
import { colors, fonts } from "../theme";
import { useToast } from "./Toast";

function syncLabel(online: boolean, waiting: number): string {
    if (!online) return waiting > 0 ? `${waiting} to sync` : "";
    return waiting > 0 ? `Syncing ${waiting}` : "";
}

export function AppHeader() {
    const client = useQueryClient();
    const online = useOnline();
    const waiting = useMutationState({ filters: { status: "pending" } }).length;
    const show = useToast();
    const label = syncLabel(online, waiting);

    async function leave() {
        if (!online) {
            show("Signing out needs a connection");
            return;
        }
        await signOut();
        await forgetSignIn();
        client.clear();
        await persister.removeClient();
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
            {label && <Text style={styles.status}>{label}</Text>}
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
    status: { marginLeft: 6, marginTop: 2, fontFamily: fonts.regular, fontSize: 11, color: colors.muted },
    action: { marginLeft: "auto", padding: 6 },
});
