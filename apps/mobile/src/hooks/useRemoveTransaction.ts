import { useAddTransaction, useDeleteTransaction } from "@lofit/api";
import type { Transaction } from "@lofit/domain";
import { useToast } from "../components/Toast";

export function useRemoveTransaction() {
    const remove = useDeleteTransaction();
    const restore = useAddTransaction();
    const show = useToast();

    return (transaction: Transaction) => {
        const { id, ...draft } = transaction;

        remove.mutate(id, {
            onSuccess: () =>
                show(`Removed ${transaction.name}`, {
                    label: "Undo",
                    run: () => restore.mutate(draft),
                }),
        });
    };
}
