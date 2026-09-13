import type { Group, NewGroup } from "@lofit/domain";
import { api, apiError, fromJson } from "./client";

export async function fetchGroups(): Promise<readonly Group[]> {
    const response = await api().groups.$get();
    if (!response.ok) throw await apiError(response);
    return fromJson(await response.json());
}

export async function addGroup(draft: NewGroup): Promise<Group> {
    const response = await api().groups.$post({ json: draft });
    if (!response.ok) throw await apiError(response);
    return fromJson(await response.json());
}
