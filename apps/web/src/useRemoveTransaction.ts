import { useAddTransaction, useDeleteTransaction } from "@lofit/api";
import type { Transaction } from "@lofit/domain";
import { useToast } from "./toast";

export function useRemoveTransaction() {
    const remove = useDeleteTransaction();
    const restore = useAddTransaction();
    const show = useToast();

    return (transaction: Transaction) => {
        remove.mutate(transaction.id, {
            onSuccess: () => {
                show(`Removed ${transaction.name}`, {
                    label: "Undo",
                    run: () => restore.mutate(transaction),
                });
            },
        });
    };
}
