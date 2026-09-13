import type { Snapshot } from "@lofit/domain";
import { api, apiError, fromJson } from "./client";

export async function fetchSnapshots(): Promise<readonly Snapshot[]> {
    const response = await api().snapshots.$get();
    if (!response.ok) throw await apiError(response);
    return fromJson(await response.json());
}
