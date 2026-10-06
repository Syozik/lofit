import { sameGroupName } from "@lofit/domain";
import type { Group, NewGroup } from "@lofit/domain";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { newId } from "./ids";
import { MUTATIONS } from "./mutations";
import type { NamedDraft } from "./mutations";

export function useAddGroup() {
    const client = useQueryClient();
    const mutation = useMutation<Group, Error, NamedDraft>({ mutationKey: MUTATIONS.addGroup });

    const mutateAsync = async (draft: NewGroup): Promise<Group> => {
        const known = client
            .getQueryData<readonly Group[]>(["groups"])
            ?.find((group) => sameGroupName(group.name, draft.name));
        if (known) return known;

        const id = draft.id ?? newId();
        mutation.mutate({ id, name: draft.name });
        const groups = client.getQueryData<readonly Group[]>(["groups"]);
        return groups?.find((group) => group.id === id) ?? { id, name: draft.name, position: groups?.length ?? 0, invests: false };
    };

    return { ...mutation, mutateAsync };
}
