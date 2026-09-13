import { useMutation, useQueryClient } from "@tanstack/react-query";
import { addAccount } from "./accounts";

export function useAddAccount() {
    const client = useQueryClient();

    return useMutation({
        mutationFn: addAccount,
        onSuccess: async () => {
            await client.invalidateQueries({ queryKey: ["accounts"] });
        },
    });
}
