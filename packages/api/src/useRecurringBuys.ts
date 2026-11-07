import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchRecurringBuys, removeRecurringBuy, updateRecurringBuy } from "./recurringBuys";

const TOUCHED = ["recurring-buys", "holdings", "portfolio", "accounts", "snapshots"];

function useRefresh() {
    const client = useQueryClient();
    return () => Promise.all(TOUCHED.map((key) => client.invalidateQueries({ queryKey: [key] })));
}

export function useRecurringBuys() {
    return useQuery({ queryKey: ["recurring-buys"], queryFn: fetchRecurringBuys });
}

export function useUpdateRecurringBuy() {
    const refresh = useRefresh();
    return useMutation({ mutationFn: updateRecurringBuy, onSuccess: refresh });
}

export function useRemoveRecurringBuy() {
    const refresh = useRefresh();
    return useMutation({ mutationFn: removeRecurringBuy, onSuccess: refresh });
}
