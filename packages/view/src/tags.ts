import type { Transaction, TransactionKind } from "@lofit/domain";

export function tagUsage(transactions: readonly Transaction[]): Map<string, number> {
    const usage = new Map<string, number>();
    for (const transaction of transactions) {
        for (const id of transaction.tagIds) usage.set(id, (usage.get(id) ?? 0) + 1);
    }
    return usage;
}

export function topTags<T extends { id: string }>(
    tags: readonly T[],
    usage: ReadonlyMap<string, number>,
    count: number,
    keep: readonly string[] = [],
): { visible: T[]; hidden: number } {
    if (tags.length <= count + 1) return { visible: [...tags], hidden: 0 };

    const top = new Set(
        [...tags]
            .sort((one, other) => (usage.get(other.id) ?? 0) - (usage.get(one.id) ?? 0))
            .slice(0, count)
            .map((tag) => tag.id),
    );
    const visible = tags.filter((tag) => top.has(tag.id) || keep.includes(tag.id));
    return { visible, hidden: tags.length - visible.length };
}

export function tagsFromHistory(
    transactions: readonly Transaction[],
    name: string,
    kind: TransactionKind,
): string[] | undefined {
    const wanted = name.trim().toLowerCase();
    if (!wanted) return undefined;

    let latest: Transaction | undefined;
    for (const transaction of transactions) {
        if (transaction.kind !== kind || transaction.name.trim().toLowerCase() !== wanted) continue;
        if (!latest || transaction.occurredAt > latest.occurredAt) latest = transaction;
    }
    return latest ? [...latest.tagIds] : undefined;
}
