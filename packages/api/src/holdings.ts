import type { Holding, NewHolding, PriceHistory, QuoteRef, Trade } from "@lofit/domain";
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
    symbol?: string;
    name?: string;
    quote?: QuoteRef | null;
}): Promise<Holding> {
    const { id, ...json } = update;
    const response = await api().holdings[":id"].$patch({ param: { id }, json });
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

export async function fetchHoldingHistory(id: string): Promise<PriceHistory | null> {
    const response = await api().holdings[":id"].history.$get({ param: { id } });
    if (!response.ok) throw await apiError(response);
    return fromJson(await response.json());
}

export async function fetchHoldingTrades(id: string): Promise<readonly Trade[]> {
    const response = await api().holdings[":id"].trades.$get({ param: { id } });
    if (!response.ok) throw await apiError(response);
    return fromJson(await response.json());
}

export async function deleteHoldingTrade(target: { id: string; tradeId: string }): Promise<Holding> {
    const response = await api().holdings[":id"].trades[":tradeId"].$delete({ param: target });
    if (!response.ok) throw await apiError(response);
    return fromJson(await response.json());
}

export async function fetchTrades(): Promise<readonly Trade[]> {
    const response = await api().holdings.trades.$get();
    if (!response.ok) throw await apiError(response);
    return fromJson(await response.json());
}

export async function updateHoldingTrade(update: {
    id: string;
    tradeId: string;
    quantity: number;
    price: number;
    day: string;
}): Promise<Holding> {
    const { id, tradeId, ...json } = update;
    const response = await api().holdings[":id"].trades[":tradeId"].$patch({ param: { id, tradeId }, json });
    if (!response.ok) throw await apiError(response);
    return fromJson(await response.json());
}
