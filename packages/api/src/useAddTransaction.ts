import type { NewTransaction, Transaction } from "@lofit/domain";
import { useMutation } from "@tanstack/react-query";
import type { MutateOptions } from "@tanstack/react-query";
import { newId } from "./ids";
import { MUTATIONS } from "./mutations";
import type { TransactionDraft } from "./mutations";

export function useAddTransaction() {
    const mutation = useMutation<Transaction, Error, TransactionDraft>({ mutationKey: MUTATIONS.addTransaction });

    return {
        ...mutation,
        mutate: (draft: NewTransaction, options?: MutateOptions<Transaction, Error, TransactionDraft>) =>
            mutation.mutate({ ...draft, id: draft.id ?? newId() }, options),
    };
}
