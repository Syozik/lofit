import { cents, EURO } from "@lofit/domain";
import type {
    Account,
    Budget,
    Currency,
    Group,
    Holding,
    Snapshot,
    Tag,
    Transaction,
} from "@lofit/domain";
import type { accounts, budgets, groups, holdings, snapshots, tags, transactions } from "./schema";

export function toAccount(row: typeof accounts.$inferSelect): Account {
    const account: Account = {
        id: row.id,
        name: row.name,
        subtitle: row.subtitle,
        groupId: row.groupId,
        balance: row.balance,
        provenance: row.provenance,
    };

    if (row.lastSyncedAt) account.lastSyncedAt = row.lastSyncedAt.toISOString();
    if (row.statedAt) account.statedAt = row.statedAt.toISOString();
    if (row.change) account.change = row.change;
    if (row.details) account.details = row.details;

    return account;
}

export function toHolding(row: typeof holdings.$inferSelect): Holding {
    const holding: Holding = {
        id: row.id,
        symbol: row.symbol,
        name: row.name,
        type: row.type,
        accountId: row.accountId,
        cost: row.cost,
        heldSince: row.heldSince,
        quantity: row.quantity,
        price: row.price,
        nativePrice: row.nativePrice ?? row.price,
        currency: (row.currency ?? EURO) as Currency,
    };

    if (row.pricedAt) holding.pricedAt = row.pricedAt.toISOString();
    if (row.quote) holding.quote = row.quote;

    return holding;
}

export function toTag(row: typeof tags.$inferSelect): Tag {
    return { id: row.id, name: row.name, kind: row.kind, position: row.position };
}

export function toTransaction(
    row: typeof transactions.$inferSelect,
    tagIds: readonly string[],
): Transaction {
    const transaction: Transaction = {
        id: row.id,
        name: row.name,
        kind: row.kind,
        tagIds,
        accountId: row.accountId,
        amount: row.amount,
        occurredAt: row.occurredAt.toISOString(),
    };

    if (row.toAccountId) transaction.toAccountId = row.toAccountId;

    return transaction;
}

export function toBudget(row: Pick<typeof budgets.$inferSelect, "tagId" | "limit">): Budget {
    return { tagId: row.tagId, limit: row.limit };
}

export function toGroup(row: typeof groups.$inferSelect): Group {
    return { id: row.id, name: row.name, position: row.position, invests: row.invests };
}

export function toSnapshots(rows: readonly (typeof snapshots.$inferSelect)[]): Snapshot[] {
    const byDay = new Map<string, Snapshot>();

    for (const row of rows) {
        const snapshot = byDay.get(row.day) ?? { day: row.day, groups: [] };
        byDay.set(row.day, {
            day: row.day,
            groups: [...snapshot.groups, { groupId: row.groupId, amount: cents(row.amount) }],
        });
    }

    return [...byDay.values()];
}
