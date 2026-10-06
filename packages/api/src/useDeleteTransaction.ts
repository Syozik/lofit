import { useMutation } from "@tanstack/react-query";
import { MUTATIONS } from "./mutations";

export function useDeleteTransaction() {
    return useMutation<void, Error, string>({ mutationKey: MUTATIONS.deleteTransaction });
}
