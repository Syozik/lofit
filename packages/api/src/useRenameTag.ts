import type { Tag } from "@lofit/domain";
import { useMutation } from "@tanstack/react-query";
import { MUTATIONS } from "./mutations";
import type { NamedDraft } from "./mutations";

export function useRenameTag() {
    return useMutation<Tag, Error, NamedDraft>({ mutationKey: MUTATIONS.renameTag });
}
