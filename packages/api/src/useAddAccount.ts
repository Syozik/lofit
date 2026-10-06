import type { Account, NewAccount } from "@lofit/domain";
import { useMutation } from "@tanstack/react-query";
import type { MutateOptions } from "@tanstack/react-query";
import { newId } from "./ids";
import { MUTATIONS } from "./mutations";
import type { AccountDraft } from "./mutations";

export function useAddAccount() {
    const mutation = useMutation<Account, Error, AccountDraft>({ mutationKey: MUTATIONS.addAccount });

    return {
        ...mutation,
        mutate: (draft: NewAccount, options?: MutateOptions<Account, Error, AccountDraft>) =>
            mutation.mutate({ ...draft, id: draft.id ?? newId() }, options),
    };
}
