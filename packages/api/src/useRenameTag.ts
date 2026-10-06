import { useMutation, useQueryClient } from "@tanstack/react-query";
import { renameTag } from "./tags";

export function useRenameTag() {
    const client = useQueryClient();

    return useMutation({
        mutationFn: renameTag,
        onSuccess: async () => {
            await client.invalidateQueries({ queryKey: ["tags"] });
        },
    });
}
