import { EURO, setDisplayCurrency } from "@lofit/domain";
import type { Currency, Settings } from "@lofit/domain";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchSettings, updateSettings } from "./settings";

export function useSettings() {
    return useQuery({ queryKey: ["settings"], queryFn: fetchSettings });
}

export function useDisplayCurrency(fallback: Currency = EURO): Currency {
    const currency = useSettings().data?.currency ?? fallback;
    setDisplayCurrency(currency);
    return currency;
}

export function useUpdateSettings() {
    const client = useQueryClient();
    return useMutation<Settings, Error, Settings>({
        mutationFn: updateSettings,
        onSuccess: async (settings) => {
            client.setQueryData(["settings"], settings);
            await client.invalidateQueries({ predicate: (query) => query.queryKey[0] !== "settings" });
        },
    });
}
