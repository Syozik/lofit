import { isUnreachable } from "@lofit/api";
import type { Screenshot, useImportScreenshot } from "@lofit/api";
import * as DocumentPicker from "expo-document-picker";
import { TriangleAlert } from "lucide-react-native";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { colors, fonts, space } from "../theme";
import { Button } from "./Button";
import { SheetActions } from "./Sheet";

const MAX_BASE64 = 4_500_000;

const MEDIA_TYPES: Record<string, Screenshot["mediaType"]> = {
    "image/png": "image/png",
    "image/jpeg": "image/jpeg",
    "image/jpg": "image/jpeg",
    "image/webp": "image/webp",
    "image/gif": "image/gif",
    "application/pdf": "application/pdf",
};

export type Picked = { screenshot: Screenshot } | { tooLarge: true } | { unsupported: true } | null;

export async function pickFile(): Promise<Picked> {
    const result = await DocumentPicker.getDocumentAsync({
        type: ["image/*", "application/pdf"],
        copyToCacheDirectory: true,
    });
    const file = result.canceled ? undefined : result.assets[0];
    if (!file) return null;
    const mediaType = file.mimeType ? MEDIA_TYPES[file.mimeType.toLowerCase()] : undefined;
    if (!mediaType) return { unsupported: true };
    if (file.size !== undefined && Math.ceil(file.size / 3) * 4 > MAX_BASE64) return { tooLarge: true };

    const image = await readBase64(file.uri);
    if (image.length > MAX_BASE64) return { tooLarge: true };
    return { screenshot: { image, mediaType } };
}

async function readBase64(uri: string): Promise<string> {
    const blob = await (await fetch(uri)).blob();
    const url = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error ?? new Error("Couldn't read the file"));
        reader.readAsDataURL(blob);
    });
    return url.slice(url.indexOf(",") + 1);
}

type Reading = ReturnType<typeof useImportScreenshot>;

type Props = {
    reading: Reading;
    statement: boolean;
    onBack: () => void;
    onRetry: () => void;
    onClose: () => void;
};

export function ScreenshotImportView({ reading, statement, onBack, onRetry, onClose }: Props) {
    if (reading.isPending) {
        return (
            <>
                <View style={styles.status}>
                    <ActivityIndicator color={colors.accent} />
                    <Text style={styles.statusText}>{statement ? "Reading statement…" : "Reading screenshot…"}</Text>
                </View>
                <SheetActions>
                    <Button variant="secondary" label="Cancel" onPress={onBack} style={{ flex: 1 }} />
                </SheetActions>
            </>
        );
    }

    if (reading.isError) {
        return (
            <>
                <View style={styles.status}>
                    <TriangleAlert size={22} color={colors.danger} />
                    <Text style={styles.statusText}>
                        {isUnreachable(reading.error) ? "Importing needs a connection" : reading.error.message}
                    </Text>
                </View>
                <SheetActions>
                    <Button variant="secondary" label="Back" onPress={onBack} style={{ flex: 1 }} />
                    <Button label="Try again" onPress={onRetry} style={{ flex: 2 }} />
                </SheetActions>
            </>
        );
    }

    if (!reading.data || reading.data.drafts.length > 0) return null;

    return (
        <>
            <View style={styles.status}>
                <Text style={styles.statusTitle}>Nothing new found</Text>
                {reading.data.skipped > 0 && <Text style={styles.statusText}>{skippedText(reading.data.skipped)}</Text>}
            </View>
            <SheetActions>
                <Button variant="secondary" label="Close" onPress={onClose} style={{ flex: 1 }} />
            </SheetActions>
        </>
    );
}

export function skippedText(skipped: number): string {
    return `Skipped ${skipped} already logged`;
}

const styles = StyleSheet.create({
    status: { alignItems: "center", gap: space[4], paddingVertical: space[8] },
    statusTitle: { fontFamily: fonts.medium, fontSize: 15, color: colors.text },
    statusText: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, textAlign: "center" },
});
