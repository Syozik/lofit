import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteTransaction } from "./transactions";

export function useDeleteTransaction() {
    const client = useQueryClient();

    return useMutation({
        mutationFn: deleteTransaction,
        onSuccess: async () => {
            await Promise.all([
                client.invalidateQueries({ queryKey: ["transactions"] }),
                client.invalidateQueries({ queryKey: ["accounts"] }),
            ]);
        },
    });
}
