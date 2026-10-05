import { useMutation, useQueryClient } from "@tanstack/react-query";
import { refreshPrices } from "./prices";

export function useRefreshPrices() {
    const client = useQueryClient();

    return useMutation({
        mutationFn: refreshPrices,
        onSuccess: async () => {
            await Promise.all([
                client.invalidateQueries({ queryKey: ["holdings"] }),
                client.invalidateQueries({ queryKey: ["portfolio"] }),
            ]);
        },
    });
}
