import { useQuery } from "@tanstack/react-query";
import { fetchBudgets } from "./budgets";

export function useBudgets() {
    return useQuery({ queryKey: ["budgets"], queryFn: fetchBudgets });
}
