import { useMutation, useQueryClient } from "@tanstack/react-query";
import { addTag } from "./tags";

export function useAddTag() {
    const client = useQueryClient();

    return useMutation({
        mutationFn: addTag,
        onSuccess: async () => {
            await client.invalidateQueries({ queryKey: ["tags"] });
        },
    });
}
