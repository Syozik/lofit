import { useDeleteAccount, useTransactions } from "@lofit/api";
import type { Account } from "@lofit/domain";
import { Sheet } from "./sheet";

type Props = {
    account: Account;
    onClose: () => void;
    onDeleted: (message: string) => void;
};

export function AccountDelete({ account, onClose, onDeleted }: Props) {
    const remove = useDeleteAccount();
    const transactions = useTransactions();

    function confirm() {
        remove.mutate(account.id, {
            onSuccess: () => {
                onDeleted(`Deleted ${account.name}`);
                onClose();
            },
        });
    }

    return (
        <Sheet label={`Delete ${account.name}`} onClose={onClose}>
            <div className="sheet-head">
                <h4 className="sheet-title">Delete {account.name}?</h4>
            </div>

            <p className="sheet-warning">
                This account might be not empty. This action can't be undone.
            </p>

            {remove.isError && (
                <p className="sheet-warning">Could not delete the account. Try again.</p>
            )}

            <div className="sheet-actions">
                <button className="btn btn-secondary" onClick={onClose}>
                    Cancel
                </button>
                <button
                    className="btn btn-secondary sheet-remove sheet-save"
                    disabled={remove.isPending || transactions.isPending}
                    onClick={confirm}
                >
                    {remove.isPending ? "Deleting…" : "Delete account"}
                </button>
            </div>
        </Sheet>
    );
}
