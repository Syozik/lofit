import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { StyleSheet, Text } from "react-native";
import { localBackend, setMode } from "../mode";
import { forgetCache } from "../queryClient";
import type { Colors } from "../theme";
import { fonts, useStyles } from "../theme";
import { Button } from "./Button";
import { Sheet, SheetActions } from "./Sheet";

export function EraseSheet({ onClose }: { onClose: () => void }) {
    const styles = useStyles(makeStyles);
    const client = useQueryClient();
    const [pending, setPending] = useState(false);
    const [failed, setFailed] = useState(false);

    async function erase() {
        setPending(true);
        setFailed(false);
        try {
            await localBackend.erase();
            await forgetCache(client, "guest");
            await setMode("account");
        } catch {
            setFailed(true);
            setPending(false);
        }
    }

    return (
        <Sheet title="Erase data on this phone?" onClose={onClose}>
            <Text style={styles.warning}>
                This deletes everything on this phone. It can't be undone.
            </Text>
            {failed && <Text style={styles.warning}>Could not erase the data. Try again.</Text>}
            <SheetActions>
                <Button variant="secondary" label="Cancel" onPress={onClose} style={{ flex: 1 }} />
                <Button
                    variant="danger"
                    label={pending ? "Erasing…" : "Erase"}
                    disabled={pending}
                    onPress={() => void erase()}
                    style={{ flex: 2 }}
                />
            </SheetActions>
        </Sheet>
    );
}

const makeStyles = (colors: Colors) =>
    StyleSheet.create({
        warning: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.quiet },
    });
