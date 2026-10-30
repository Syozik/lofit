import { negateCents } from "./money";
import type { Cents, Currency } from "./money";
import type { TransactionKind } from "./types";

export interface Transaction {
    id: string;
    name: string;
    kind: TransactionKind;
    tagIds: readonly string[];
    accountId: string;
    toAccountId?: string;
    amount: Cents;
    toAmount?: Cents;
    occurredAt: string;
    original?: { amount: Cents; currency: Currency };
}

export type NewTransaction = Omit<Transaction, "id" | "original"> & { id?: string; currency?: Currency };

export function primaryTagId(transaction: Pick<Transaction, "tagIds">): string | undefined {
    return transaction.tagIds[0];
}

const DAY = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export function isDay(value: string): boolean {
    return DAY.test(value) && !Number.isNaN(Date.parse(value));
}

const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

export function isInstant(value: string): boolean {
    return INSTANT.test(value);
}

export interface BalanceChange {
    accountId: string;
    delta: Cents;
}

export function balanceChanges(transaction: {
    accountId: string;
    toAccountId?: string | undefined;
    amount: Cents;
    toAmount?: Cents | undefined;
}): BalanceChange[] {
    const changes: BalanceChange[] = [
        { accountId: transaction.accountId, delta: transaction.amount },
    ];

    if (transaction.toAccountId) {
        changes.push({
            accountId: transaction.toAccountId,
            delta: transaction.toAmount ?? negateCents(transaction.amount),
        });
    }

    return changes;
}
