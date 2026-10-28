import { useDeleteAccount } from "@lofit/api";
import type { Account } from "@lofit/domain";
import { StyleSheet, Text } from "react-native";
import type { Colors } from "../theme";
import { fonts, useStyles } from "../theme";
import { Button } from "./Button";
import { Sheet, SheetActions } from "./Sheet";
import { useOnline } from "../connectivity";
import { useToast } from "./Toast";

type Props = {
    account: Account;
    onClose: () => void;
    onDeleted: () => void;
};

export function AccountDelete({ account, onClose, onDeleted }: Props) {
    const styles = useStyles(makeStyles);
    const remove = useDeleteAccount();
    const show = useToast();
    const online = useOnline();

    function confirm() {
        remove.mutate(account.id, {
            onSuccess: () => {
                show(`Deleted ${account.name}`);
                onDeleted();
                onClose();
            },
        });
    }

    return (
        <Sheet title={`Delete ${account.name}?`} onClose={onClose}>
            <Text style={styles.warning}>
                This account might be not empty. This action can't be undone.
            </Text>
            {remove.isError && (
                <Text style={styles.warning}>Could not delete the account. Try again.</Text>
            )}
            <SheetActions>
                <Button variant="secondary" label="Cancel" onPress={onClose} style={{ flex: 1 }} />
                <Button
                    variant="danger"
                    label={online ? (remove.isPending ? "Deleting…" : "Delete account") : "Needs a connection"}
                    disabled={remove.isPending || !online}
                    onPress={confirm}
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
