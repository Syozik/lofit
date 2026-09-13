import type { Budget } from "@lofit/domain";
import { api, apiError, fromJson } from "./client";

export async function fetchBudgets(): Promise<readonly Budget[]> {
    const response = await api().budgets.$get();
    if (!response.ok) throw await apiError(response);
    return fromJson(await response.json());
}
