import { useQuery } from "@tanstack/react-query";
import { fetchPortfolioHistory, fetchPortfolioIntraday } from "./portfolio";

export function usePortfolioHistory(group: string | undefined, intraday: boolean) {
    return useQuery({
        queryKey: ["portfolio", group, intraday ? "intraday" : "daily"],
        queryFn: () => (intraday ? fetchPortfolioIntraday(group) : fetchPortfolioHistory(group)),
        enabled: group !== undefined,
        staleTime: (intraday ? 5 : 30) * 60 * 1000,
    });
}
