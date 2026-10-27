import { useMutation } from "@tanstack/react-query";
import type { BudgetChange } from "./budgets";
import { MUTATIONS } from "./mutations";

export function useSetBudget() {
    return useMutation<void, Error, BudgetChange>({ mutationKey: MUTATIONS.setBudget });
}
