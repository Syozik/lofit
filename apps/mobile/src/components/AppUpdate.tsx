import Constants from "expo-constants";
import * as Updates from "expo-updates";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { Colors } from "../theme";
import { fonts, space, useStyles } from "../theme";
import { Button } from "./Button";

type State = "checking" | "current" | "available" | "downloading" | "failed";

const HINTS: Record<State, string> = {
    checking: "Checking for updates…",
    current: "You're on the latest version.",
    available: "A new version is ready to install.",
    downloading: "Downloading the update…",
    failed: "Couldn't check for updates. Check your connection.",
};

export function AppUpdate() {
    const styles = useStyles(makeStyles);
    const [state, setState] = useState<State>("checking");

    function check() {
        setState("checking");
        void look();
    }

    async function look() {
        try {
            const result = await Updates.checkForUpdateAsync();
            setState(result.isAvailable ? "available" : "current");
        } catch {
            setState("failed");
        }
    }

    async function install() {
        setState("downloading");
        try {
            const result = await Updates.fetchUpdateAsync();
            if (result.isNew) await Updates.reloadAsync();
            else setState("current");
        } catch {
            setState("failed");
        }
    }

    useEffect(() => {
        if (Updates.isEnabled) void look();
    }, []);

    if (!Updates.isEnabled) return null;

    const busy = state === "checking" || state === "downloading";

    return (
        <View style={styles.row}>
            <View style={styles.text}>
                <Text style={styles.name}>Version {Constants.expoConfig?.version}</Text>
                <Text style={[styles.hint, state === "available" && styles.accent]}>{HINTS[state]}</Text>
            </View>
            {state === "available" || state === "downloading" ? (
                <Button
                    label={state === "downloading" ? "Updating…" : "Update"}
                    disabled={busy}
                    onPress={() => void install()}
                />
            ) : (
                <Button variant="secondary" label="Check" disabled={busy} onPress={check} />
            )}
        </View>
    );
}

const makeStyles = (colors: Colors) =>
    StyleSheet.create({
        row: { flexDirection: "row", alignItems: "center", gap: space[4] },
        text: { flex: 1, gap: 2 },
        name: { fontFamily: fonts.regular, fontSize: 14, color: colors.text },
        hint: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
        accent: { color: colors.accentStrong },
    });
