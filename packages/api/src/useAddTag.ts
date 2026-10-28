import { sameTagName } from "@lofit/domain";
import type { NewTag, Tag } from "@lofit/domain";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { newId } from "./ids";
import { MUTATIONS } from "./mutations";
import type { TagDraft } from "./mutations";

export function useAddTag() {
    const client = useQueryClient();
    const mutation = useMutation<Tag, Error, TagDraft>({ mutationKey: MUTATIONS.addTag });

    const mutateAsync = async (draft: NewTag): Promise<Tag> => {
        const kind = draft.kind ?? "expense";
        const known = client
            .getQueryData<readonly Tag[]>(["tags"])
            ?.find((tag) => tag.kind === kind && sameTagName(tag.name, draft.name));
        if (known) return known;

        const id = draft.id ?? newId();
        mutation.mutate({ id, name: draft.name, kind });
        const tags = client.getQueryData<readonly Tag[]>(["tags"]);
        return tags?.find((tag) => tag.id === id) ?? { id, name: draft.name, kind, position: tags?.length ?? 0 };
    };

    return { ...mutation, mutateAsync };
}
