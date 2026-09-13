import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateAccountBalance } from "./accounts";

export function useUpdateAccountBalance() {
    const client = useQueryClient();

    return useMutation({
        mutationFn: updateAccountBalance,
        onSuccess: async () => {
            await client.invalidateQueries({ queryKey: ["accounts"] });
        },
    });
}
