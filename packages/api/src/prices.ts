import { api, apiError, fromJson } from "./client";

export interface RefreshReport {
    changed: number;
    confirmed: number;
    missing: number;
}

export async function refreshPrices(): Promise<RefreshReport> {
    const response = await api().prices.refresh.$post();
    if (!response.ok) throw await apiError(response);
    return fromJson(await response.json());
}
