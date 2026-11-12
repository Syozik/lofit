import { useQuery } from "@tanstack/react-query";
import { fetchHoldingTrades, fetchTrades } from "./holdings";

export function useHoldingTrades(id: string) {
    return useQuery({
        queryKey: ["holdings", id, "trades"],
        queryFn: () => fetchHoldingTrades(id),
    });
}

export function useTrades() {
    return useQuery({ queryKey: ["holdings", "trades"], queryFn: fetchTrades });
}
