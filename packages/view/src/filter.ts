import type { SpendSummary, Tag, Transaction } from "@lofit/domain";
import { UNTAGGED_KEY } from "./spending";

export type SpendFilter = {
    query: string;
    tagIds: readonly string[];
    accountIds: readonly string[];
};

export type FilterOption = { id: string; label: string };

export const NO_FILTER: SpendFilter = { query: "", tagIds: [], accountIds: [] };

export function isFiltered(filter: SpendFilter): boolean {
    return filter.query.trim() !== "" || filter.tagIds.length > 0 || filter.accountIds.length > 0;
}

export function toggled(ids: readonly string[], id: string): string[] {
    return ids.includes(id) ? ids.filter((one) => one !== id) : [...ids, id];
}

export function matchedKeys(summary: SpendSummary): Set<string> {
    return new Set(summary.tags.filter((row) => row.spent > 0).map((row) => row.tagId ?? UNTAGGED_KEY));
}

export function litSlices(tagsOf: ReadonlyMap<string, ReadonlySet<string>>, matched: ReadonlySet<string>): Set<string> {
    return new Set([...tagsOf].filter(([, ids]) => [...ids].some((id) => matched.has(id))).map(([key]) => key));
}

export function toggledAll(ids: readonly string[], group: ReadonlySet<string>): string[] {
    const all = [...group].every((id) => ids.includes(id));
    return all ? ids.filter((id) => !group.has(id)) : [...new Set([...ids, ...group])];
}

function searchText(
    transaction: Transaction,
    tagNames: ReadonlyMap<string, string>,
    accountNames: ReadonlyMap<string, string>,
): string {
    return [
        transaction.name,
        ...transaction.tagIds.map((id) => tagNames.get(id) ?? ""),
        accountNames.get(transaction.accountId) ?? "",
        transaction.toAccountId ? (accountNames.get(transaction.toAccountId) ?? "") : "",
        (Math.abs(transaction.amount) / 100).toFixed(2),
    ]
        .join(" ")
        .toLowerCase();
}

export function filterTransactions(
    transactions: readonly Transaction[],
    filter: SpendFilter,
    tagNames: ReadonlyMap<string, string>,
    accountNames: ReadonlyMap<string, string>,
): Transaction[] {
    const terms = filter.query.toLowerCase().replace(/,/g, "").split(/\s+/).filter(Boolean);
    return transactions.filter((transaction) => {
        if (filter.tagIds.length > 0) {
            const tagged =
                transaction.tagIds.length > 0
                    ? transaction.tagIds.some((id) => filter.tagIds.includes(id))
                    : filter.tagIds.includes(UNTAGGED_KEY);
            if (!tagged) return false;
        }
        if (filter.accountIds.length > 0) {
            const touches =
                filter.accountIds.includes(transaction.accountId) ||
                (transaction.toAccountId !== undefined && filter.accountIds.includes(transaction.toAccountId));
            if (!touches) return false;
        }
        if (terms.length === 0) return true;
        const text = searchText(transaction, tagNames, accountNames);
        return terms.every((term) => text.includes(term));
    });
}

export function filterOptions(
    transactions: readonly Transaction[],
    tags: readonly Tag[],
    accountNames: ReadonlyMap<string, string>,
    filter: SpendFilter,
): { tags: FilterOption[]; accounts: FilterOption[] } {
    const usedTags = new Set([...transactions.flatMap((transaction) => transaction.tagIds), ...filter.tagIds]);
    const untagged =
        usedTags.has(UNTAGGED_KEY) ||
        transactions.some((transaction) => transaction.kind === "expense" && transaction.tagIds.length === 0);
    const usedAccounts = new Set([
        ...filter.accountIds,
        ...transactions.flatMap((transaction) =>
            transaction.toAccountId ? [transaction.accountId, transaction.toAccountId] : [transaction.accountId],
        ),
    ]);
    return {
        tags: [...tags]
            .filter((tag) => usedTags.has(tag.id))
            .sort((one, other) => one.position - other.position)
            .map((tag) => ({ id: tag.id, label: tag.name }))
            .concat(untagged ? [{ id: UNTAGGED_KEY, label: "Untagged" }] : []),
        accounts: [...usedAccounts]
            .flatMap((id) => {
                const label = accountNames.get(id);
                return label ? [{ id, label }] : [];
            })
            .sort((one, other) => one.label.localeCompare(other.label)),
    };
}
