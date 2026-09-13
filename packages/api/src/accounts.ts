import type { Account, NewAccount } from "@lofit/domain";
import { api, apiError, fromJson } from "./client";

export async function fetchAccounts(): Promise<readonly Account[]> {
    const response = await api().accounts.$get();
    if (!response.ok) throw await apiError(response);
    return fromJson(await response.json());
}

export async function addAccount(draft: NewAccount): Promise<Account> {
    const response = await api().accounts.$post({ json: draft });
    if (!response.ok) throw await apiError(response);
    return fromJson(await response.json());
}

export async function updateAccountBalance(update: {
    id: string;
    balance: number;
}): Promise<Account> {
    const response = await api().accounts[":id"].$patch({
        param: { id: update.id },
        json: { balance: update.balance },
    });
    if (!response.ok) throw await apiError(response);
    return fromJson(await response.json());
}
