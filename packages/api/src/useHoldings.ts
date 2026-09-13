import { useQuery } from "@tanstack/react-query";
import { fetchHoldings } from "./holdings";

export function useHoldings() {
    return useQuery({ queryKey: ["holdings"], queryFn: fetchHoldings });
}
