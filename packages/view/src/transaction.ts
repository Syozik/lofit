import { balanceChanges, KIND_LABELS } from "@lofit/domain";
import type { Transaction } from "@lofit/domain";

const dayFormat = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
});

export function transactionMeta(
    transaction: Transaction,
    accountNames: ReadonlyMap<string, string>,
    tagNames: ReadonlyMap<string, string>,
    viewedFrom?: string,
): string {
    const labels = transaction.tagIds.map((id) => tagNames.get(id) ?? "Unknown tag");
    const what = labels.length > 0 ? labels.join(" · ") : KIND_LABELS[transaction.kind];

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

    return [dayFormat.format(new Date(transaction.occurredAt)), what, where].filter(Boolean).join(" · ");
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
