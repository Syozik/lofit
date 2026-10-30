import { balanceChanges, displayCurrency, formatAmount, KIND_LABELS, withSymbol } from "@lofit/domain";
import type { Transaction } from "@lofit/domain";

const dayFormat = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
});

export type MetaParts = {
    lead: string;
    tags: { id: string; name: string }[];
    kind: string;
    where: string;
};

export function metaParts(
    transaction: Transaction,
    accountNames: ReadonlyMap<string, string>,
    tagNames: ReadonlyMap<string, string>,
    viewedFrom?: string,
): MetaParts {
    const from = accountNames.get(transaction.accountId) ?? "Unknown account";
    const to = transaction.toAccountId ? accountNames.get(transaction.toAccountId) : undefined;
    const where = viewedFrom
        ? transaction.toAccountId === viewedFrom
            ? `from ${from}`
            : to
              ? `to ${to}`
              : ""
        : to
          ? `${from} → ${to}`
          : from;

    const paid =
        transaction.original && transaction.original.currency !== displayCurrency()
            ? withSymbol(formatAmount(transaction.original.amount), transaction.original.currency)
            : "";

    return {
        lead: [dayFormat.format(new Date(transaction.occurredAt)), paid].filter(Boolean).join(" · "),
        tags: transaction.tagIds.map((id) => ({ id, name: tagNames.get(id) ?? "Unknown tag" })),
        kind: KIND_LABELS[transaction.kind],
        where,
    };
}

export function transactionMeta(
    transaction: Transaction,
    accountNames: ReadonlyMap<string, string>,
    tagNames: ReadonlyMap<string, string>,
    viewedFrom?: string,
): string {
    const parts = metaParts(transaction, accountNames, tagNames, viewedFrom);
    const what = parts.tags.length > 0 ? parts.tags.map((tag) => tag.name).join(" · ") : parts.kind;
    return [parts.lead, what, parts.where].filter(Boolean).join(" · ");
}

export function amountFor(transaction: Transaction, viewedFrom?: string): number {
    if (!viewedFrom) return transaction.amount;
    return balanceChanges(transaction)
        .filter((change) => change.accountId === viewedFrom)
        .reduce((sum, change) => sum + change.delta, 0);
}

export function monogram(transaction: Pick<Transaction, "name">): string {
    return transaction.name.trim().charAt(0).toUpperCase();
}
