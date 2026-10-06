import { sameTagName } from "@lofit/domain";
import type { NewTag, Tag } from "@lofit/domain";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { newId } from "./ids";
import { MUTATIONS } from "./mutations";
import type { NamedDraft } from "./mutations";

export function useAddTag() {
    const client = useQueryClient();
    const mutation = useMutation<Tag, Error, NamedDraft>({ mutationKey: MUTATIONS.addTag });

    const mutateAsync = async (draft: NewTag): Promise<Tag> => {
        const known = client.getQueryData<readonly Tag[]>(["tags"])?.find((tag) => sameTagName(tag.name, draft.name));
        if (known) return known;

        const id = draft.id ?? newId();
        mutation.mutate({ id, name: draft.name });
        const tags = client.getQueryData<readonly Tag[]>(["tags"]);
        return tags?.find((tag) => tag.id === id) ?? { id, name: draft.name, position: tags?.length ?? 0 };
    };

    return { ...mutation, mutateAsync };
}
