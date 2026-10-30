import type { Settings } from "@lofit/domain";
import { api, apiError, fromJson } from "./client";

export async function fetchSettings(): Promise<Settings> {
    const response = await api().settings.$get();
    if (!response.ok) throw await apiError(response);
    return fromJson(await response.json());
}

export async function updateSettings(settings: Settings): Promise<Settings> {
    const response = await api().settings.$patch({ json: settings });
    if (!response.ok) throw await apiError(response);
    return fromJson(await response.json());
}
