import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addRecurring, fetchRecurring, removeRecurring, updateRecurring } from "./recurring";

const TOUCHED = ["recurring", "transactions", "accounts", "snapshots"];

function useRefresh() {
    const client = useQueryClient();
    return () => Promise.all(TOUCHED.map((key) => client.invalidateQueries({ queryKey: [key] })));
}

export function useRecurring() {
    return useQuery({ queryKey: ["recurring"], queryFn: fetchRecurring });
}

export function useAddRecurring() {
    const refresh = useRefresh();
    return useMutation({ mutationFn: addRecurring, onSuccess: refresh });
}

export function useUpdateRecurring() {
    const refresh = useRefresh();
    return useMutation({ mutationFn: updateRecurring, onSuccess: refresh });
}

export function useRemoveRecurring() {
    const refresh = useRefresh();
    return useMutation({ mutationFn: removeRecurring, onSuccess: refresh });
}
