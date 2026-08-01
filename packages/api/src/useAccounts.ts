import { useQuery } from "@tanstack/react-query";
import { fetchAccounts } from "./accounts";

export function useAccounts() {
    return useQuery({ queryKey: ['accounts'], queryFn: fetchAccounts });
}
