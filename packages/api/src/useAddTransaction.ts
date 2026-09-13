import { useMutation, useQueryClient } from "@tanstack/react-query";
import { addTransaction } from "./transactions";

export function useAddTransaction() {
    const client = useQueryClient();

    return useMutation({
        mutationFn: addTransaction,
        onSuccess: async () => {
            await Promise.all([
                client.invalidateQueries({ queryKey: ["transactions"] }),
                client.invalidateQueries({ queryKey: ["accounts"] }),
            ]);
        },
    });
}
