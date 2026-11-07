import type { RecurringBuy, RecurringBuyPatch } from "@lofit/domain";
import { api, apiError, fromJson } from "./client";

export async function fetchRecurringBuys(): Promise<readonly RecurringBuy[]> {
    const response = await api()["recurring-buys"].$get();
    if (!response.ok) throw await apiError(response);
    return fromJson(await response.json());
}

export async function updateRecurringBuy({ id, patch }: { id: string; patch: RecurringBuyPatch }): Promise<RecurringBuy> {
    const response = await api()["recurring-buys"][":id"].$patch({ param: { id }, json: patch });
    if (!response.ok) throw await apiError(response);
    return fromJson(await response.json());
}

export async function removeRecurringBuy(id: string): Promise<void> {
    const response = await api()["recurring-buys"][":id"].$delete({ param: { id } });
    if (!response.ok) throw await apiError(response);
}
