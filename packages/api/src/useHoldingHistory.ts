import { useQuery } from "@tanstack/react-query";
import { fetchHoldingHistory } from "./holdings";

export function useHoldingHistory(id: string) {
    return useQuery({
        queryKey: ["holdings", id, "history"],
        queryFn: () => fetchHoldingHistory(id),
        staleTime: 30 * 60 * 1000,
    });
}
