import type { NewTag, Tag } from "@lofit/domain";
import { api, apiError, fromJson } from "./client";

export async function fetchTags(): Promise<readonly Tag[]> {
    const response = await api().tags.$get();
    if (!response.ok) throw await apiError(response);
    return fromJson(await response.json());
}

export async function addTag(draft: NewTag): Promise<Tag> {
    const response = await api().tags.$post({ json: draft });
    if (!response.ok) throw await apiError(response);
    return fromJson(await response.json());
}

export async function renameTag(update: { id: string; name: string }): Promise<Tag> {
    const response = await api().tags[":id"].$patch({ param: { id: update.id }, json: { name: update.name } });
    if (!response.ok) throw await apiError(response);
    return fromJson(await response.json());
}
