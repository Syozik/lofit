import type { NewRecurring, Recurring, RecurringPatch } from "@lofit/domain";
import { api, apiError, fromJson } from "./client";

export async function fetchRecurring(): Promise<readonly Recurring[]> {
    const response = await api().recurring.$get();
    if (!response.ok) throw await apiError(response);
    return fromJson(await response.json());
}

export async function addRecurring(draft: NewRecurring): Promise<Recurring> {
    const response = await api().recurring.$post({ json: { ...draft, tagIds: [...draft.tagIds] } });
    if (!response.ok) throw await apiError(response);
    return fromJson(await response.json());
}

export async function updateRecurring({ id, patch }: { id: string; patch: RecurringPatch }): Promise<Recurring> {
    const response = await api().recurring[":id"].$patch({ param: { id }, json: patch });
    if (!response.ok) throw await apiError(response);
    return fromJson(await response.json());
}

export async function removeRecurring(id: string): Promise<void> {
    const response = await api().recurring[":id"].$delete({ param: { id } });
    if (!response.ok) throw await apiError(response);
}
