import type { Transaction } from "@lofit/domain";
import { useMutation } from "@tanstack/react-query";
import { MUTATIONS } from "./mutations";
import type { TransactionUpdate } from "./mutations";

export function useUpdateTransaction() {
    return useMutation<Transaction, Error, TransactionUpdate>({ mutationKey: MUTATIONS.updateTransaction });
}
