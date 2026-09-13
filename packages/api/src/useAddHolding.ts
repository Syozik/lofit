import { useMutation, useQueryClient } from "@tanstack/react-query";
import { addHolding } from "./holdings";

export function useAddHolding() {
    const client = useQueryClient();

    return useMutation({
        mutationFn: addHolding,
        onSuccess: async () => {
            await client.invalidateQueries({ queryKey: ["holdings"] });
        },
    });
}
