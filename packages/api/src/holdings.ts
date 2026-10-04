import type { Holding, NewHolding, PricePoint } from "@lofit/domain";
import { api, apiError, fromJson } from "./client";

export async function fetchHoldings(): Promise<readonly Holding[]> {
    const response = await api().holdings.$get();
    if (!response.ok) throw await apiError(response);
    return fromJson(await response.json());
}

export async function addHolding(draft: NewHolding): Promise<Holding> {
    const response = await api().holdings.$post({ json: draft });
    if (!response.ok) throw await apiError(response);
    return fromJson(await response.json());
}

export async function updateHolding(update: {
    id: string;
    quantity: number;
    cost: number;
    heldSince?: string;
}): Promise<Holding> {
    const response = await api().holdings[":id"].$patch({
        param: { id: update.id },
        json: { quantity: update.quantity, cost: update.cost, heldSince: update.heldSince },
    });
    if (!response.ok) throw await apiError(response);
    return fromJson(await response.json());
}

export async function sellHolding(order: {
    id: string;
    quantity: number;
    price: number;
}): Promise<{ sold: number; proceeds: number; realised: number }> {
    const response = await api().holdings[":id"].sell.$post({
        param: { id: order.id },
        json: { quantity: order.quantity, price: order.price },
    });
    if (!response.ok) throw await apiError(response);
    return fromJson(await response.json());
}

export async function deleteHolding(id: string): Promise<void> {
    const response = await api().holdings[":id"].$delete({ param: { id } });
    if (!response.ok) throw await apiError(response);
}

export async function fetchHoldingHistory(id: string): Promise<readonly PricePoint[]> {
    const response = await api().holdings[":id"].history.$get({ param: { id } });
    if (!response.ok) throw await apiError(response);
    return fromJson(await response.json());
}
