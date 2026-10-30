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
import type { Fx } from "../prices/fx";
import type { accounts, budgets, groups, holdings, snapshots, tags, transactions } from "./schema";

export type View = { fx: Fx; currency: string };

function shown(view: View | undefined, amount: number, from: string, day?: string) {
    return view ? view.fx.convert(cents(amount), from, view.currency, day) : cents(amount);
}

export function toAccount(row: typeof accounts.$inferSelect, view?: View): Account {
    const account: Account = {
        id: row.id,
        name: row.name,
        subtitle: row.subtitle,
        groupId: row.groupId,
        balance: shown(view, row.balance, row.currency),
        currency: row.currency as Currency,
        nativeBalance: row.balance,
        provenance: row.provenance,
    };

    if (row.lastSyncedAt) account.lastSyncedAt = row.lastSyncedAt.toISOString();
    if (row.statedAt) account.statedAt = row.statedAt.toISOString();
    if (row.change) account.change = row.change;
    if (row.details) account.details = row.details;

    return account;
}

export function toHolding(row: typeof holdings.$inferSelect, view?: View): Holding {
    const currency = row.currency ?? row.costCurrency;
    const native = row.nativePrice ?? row.price;
    const holding: Holding = {
        id: row.id,
        symbol: row.symbol,
        name: row.name,
        type: row.type,
        accountId: row.accountId,
        cost: shown(view, row.cost, row.costCurrency),
        heldSince: row.heldSince,
        quantity: row.quantity,
        price: view ? shown(view, native, currency) : row.price,
        nativePrice: native,
        currency: (currency || EURO) as Currency,
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
    accountCurrency?: string,
    view?: View,
): Transaction {
    const occurredAt = row.occurredAt.toISOString();
    const currency = accountCurrency ?? view?.currency ?? EURO;
    const transaction: Transaction = {
        id: row.id,
        name: row.name,
        kind: row.kind,
        tagIds,
        accountId: row.accountId,
        amount: shown(view, row.amount, currency, occurredAt.slice(0, 10)),
        occurredAt,
    };

    if (row.toAccountId) transaction.toAccountId = row.toAccountId;
    if (row.toAmount !== null) transaction.toAmount = row.toAmount;
    if (row.originalAmount !== null && row.originalCurrency) {
        transaction.original = { amount: row.originalAmount, currency: row.originalCurrency as Currency };
    } else if (view && currency !== view.currency) {
        transaction.original = { amount: row.amount, currency: currency as Currency };
    }

    return transaction;
}

export function toBudget(row: Pick<typeof budgets.$inferSelect, "tagId" | "limit" | "currency">, view?: View): Budget {
    return { tagId: row.tagId, limit: shown(view, row.limit, row.currency) };
}

export function toGroup(row: typeof groups.$inferSelect): Group {
    return { id: row.id, name: row.name, position: row.position, invests: row.invests };
}

export function toSnapshots(rows: readonly (typeof snapshots.$inferSelect)[], view?: View): Snapshot[] {
    const byDay = new Map<string, Snapshot>();

    for (const row of rows) {
        const snapshot = byDay.get(row.day) ?? { day: row.day, groups: [] };
        byDay.set(row.day, {
            day: row.day,
            groups: [...snapshot.groups, { groupId: row.groupId, amount: shown(view, row.amount, EURO, row.day) }],
        });
    }

    return [...byDay.values()];
}
