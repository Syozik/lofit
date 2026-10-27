import type { Budget, Cents } from "@lofit/domain";
import { api, apiError, fromJson } from "./client";

export type BudgetChange = { tagId: string; limit: Cents | null };

export async function fetchBudgets(): Promise<readonly Budget[]> {
    const response = await api().budgets.$get();
    if (!response.ok) throw await apiError(response);
    return fromJson(await response.json());
}

export async function setBudget({ tagId, limit }: BudgetChange): Promise<void> {
    const response =
        limit === null
            ? await api().budgets[":tagId"].$delete({ param: { tagId } })
            : await api().budgets[":tagId"].$put({ param: { tagId }, json: { limit } });
    if (!response.ok) throw await apiError(response);
}
