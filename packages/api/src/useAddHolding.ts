import { useMutation, useQueryClient } from "@tanstack/react-query";
import { addHolding } from "./holdings";

export function useAddHolding() {
    const client = useQueryClient();

    return useMutation({
        mutationFn: addHolding,
        onSuccess: async () => {
            await Promise.all([
                client.invalidateQueries({ queryKey: ["holdings"] }),
                client.invalidateQueries({ queryKey: ["portfolio"] }),
            ]);
        },
    });
}
