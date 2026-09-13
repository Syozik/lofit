import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateTransaction } from "./transactions";

export function useUpdateTransaction() {
    const client = useQueryClient();

    return useMutation({
        mutationFn: updateTransaction,
        onSuccess: async () => {
            await Promise.all([
                client.invalidateQueries({ queryKey: ["transactions"] }),
                client.invalidateQueries({ queryKey: ["accounts"] }),
            ]);
        },
    });
}
