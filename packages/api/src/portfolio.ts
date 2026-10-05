import type { ValuePoint } from "@lofit/domain";
import { api, apiError, fromJson } from "./client";

export async function fetchPortfolioHistory(group?: string): Promise<readonly ValuePoint[]> {
    const response = await api().portfolio.history.$get({ query: group ? { group } : {} });
    if (!response.ok) throw await apiError(response);
    return fromJson(await response.json());
}

export async function fetchPortfolioIntraday(group?: string): Promise<readonly ValuePoint[]> {
    const response = await api().portfolio.intraday.$get({ query: group ? { group } : {} });
    if (!response.ok) throw await apiError(response);
    return fromJson(await response.json());
}
