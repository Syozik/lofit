import type { Account } from "@lofit/domain";
import { useMutation } from "@tanstack/react-query";
import { MUTATIONS } from "./mutations";
import type { BalanceUpdate } from "./mutations";

export function useUpdateAccountBalance() {
    return useMutation<Account, Error, BalanceUpdate>({ mutationKey: MUTATIONS.updateBalance });
}
