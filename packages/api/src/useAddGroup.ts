import { useMutation, useQueryClient } from "@tanstack/react-query";
import { addGroup } from "./groups";

export function useAddGroup() {
    const client = useQueryClient();

    return useMutation({
        mutationFn: addGroup,
        onSuccess: async () => {
            await client.invalidateQueries({ queryKey: ["groups"] });
        },
    });
}
