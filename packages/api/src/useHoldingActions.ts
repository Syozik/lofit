import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteHolding, sellHolding, updateHolding } from "./holdings";

function useHoldingMutation<Input, Output>(run: (input: Input) => Promise<Output>) {
    const client = useQueryClient();

    return useMutation({
        mutationFn: run,
        onSuccess: async () => {
            await Promise.all([
                client.invalidateQueries({ queryKey: ["holdings"] }),
                client.invalidateQueries({ queryKey: ["accounts"] }),
                client.invalidateQueries({ queryKey: ["portfolio"] }),
            ]);
        },
    });
}

export function useUpdateHolding() {
    return useHoldingMutation(updateHolding);
}

export function useSellHolding() {
    return useHoldingMutation(sellHolding);
}

export function useDeleteHolding() {
    return useHoldingMutation(deleteHolding);
}
