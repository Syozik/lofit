import type { NewRecurring, Recurring } from "@lofit/domain";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { MutateOptions } from "@tanstack/react-query";
import { newId } from "./ids";
import { MUTATIONS } from "./mutations";
import type { RecurringDraft } from "./mutations";
import { fetchRecurring, removeRecurring, updateRecurring } from "./recurring";

const TOUCHED = ["recurring", "transactions", "accounts", "snapshots"];

function useRefresh() {
    const client = useQueryClient();
    return () => Promise.all(TOUCHED.map((key) => client.invalidateQueries({ queryKey: [key] })));
}

export function useRecurring() {
    return useQuery({ queryKey: ["recurring"], queryFn: fetchRecurring });
}

export function useAddRecurring() {
    const mutation = useMutation<Recurring, Error, RecurringDraft>({ mutationKey: MUTATIONS.addRecurring });

    return {
        ...mutation,
        mutate: (draft: NewRecurring, options?: MutateOptions<Recurring, Error, RecurringDraft>) =>
            mutation.mutate({ ...draft, id: draft.id ?? newId() }, options),
    };
}

export function useUpdateRecurring() {
    const refresh = useRefresh();
    return useMutation({ mutationFn: updateRecurring, onSuccess: refresh });
}

export function useRemoveRecurring() {
    const refresh = useRefresh();
    return useMutation({ mutationFn: removeRecurring, onSuccess: refresh });
}
