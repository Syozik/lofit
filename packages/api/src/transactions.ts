import type { NewTransaction, Transaction } from "@lofit/domain";
import { api, apiError, fromJson } from "./client";

export async function fetchTransactions(): Promise<readonly Transaction[]> {
    const response = await api().transactions.$get();
    if (!response.ok) throw await apiError(response);
    return fromJson(await response.json());
}

export async function addTransaction(draft: NewTransaction): Promise<Transaction> {
    const response = await api().transactions.$post({
        json: { ...draft, tagIds: [...draft.tagIds] },
    });
    if (!response.ok) throw await apiError(response);
    return fromJson(await response.json());
}

export async function updateTransaction(entry: {
    id: string;
    draft: NewTransaction;
}): Promise<Transaction> {
    const response = await api().transactions[":id"].$patch({
        param: { id: entry.id },
        json: { ...entry.draft, tagIds: [...entry.draft.tagIds] },
    });
    if (!response.ok) throw await apiError(response);
    return fromJson(await response.json());
}

export async function deleteTransaction(id: string): Promise<void> {
    const response = await api().transactions[":id"].$delete({ param: { id } });
    if (!response.ok) throw await apiError(response);
}
