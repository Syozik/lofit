import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteAccount } from "./accounts";

export function useDeleteAccount() {
    const client = useQueryClient();

    return useMutation({
        mutationFn: deleteAccount,
        onSuccess: async () => {
            await Promise.all(
                ["accounts", "holdings", "transactions", "portfolio"].map((key) =>
                    client.invalidateQueries({ queryKey: [key] }),
                ),
            );
        },
    });
}
