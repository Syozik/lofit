import type { Account } from "./account";
import { holdingValue } from "./holding";
import type { Holding } from "./holding";
import { addCents, cents, sumCents } from "./money";
import type { Cents } from "./money";
import { primaryTagId } from "./transaction";
import type { Transaction } from "./transaction";
import type { Tag } from "./tag";
import { ALL_GROUPS, byPosition } from "./group";
import type { Group, Scope } from "./group";
import type { Budget } from "./types";

export interface NetWorthItem {
    id: string;
    label: string;
    groupId: string;
    value: Cents;
}

export function sumItems(items: readonly NetWorthItem[]): Cents {
    return items.reduce((total, item) => addCents(total, item.value), cents(0));
}

export function netWorthItems(
    accounts: readonly Account[],
    holdings: readonly Holding[],
): NetWorthItem[] {
    const groupOf = new Map(accounts.map((account) => [account.id, account.groupId]));

    return [
        ...accounts.map((account) => ({
            id: account.id,
            label: account.name,
            groupId: account.groupId,
            value: account.balance,
        })),
        ...holdings.map((holding) => ({
            id: holding.id,
            label: holding.symbol,
            groupId: groupOf.get(holding.accountId) ?? "",
            value: holdingValue(holding),
        })),
    ];
}

export function netWorth(accounts: readonly Account[], holdings: readonly Holding[]): Cents {
    return sumItems(netWorthItems(accounts, holdings));
}

export interface NetWorthGroup {
    group: Group;
    items: readonly NetWorthItem[];
    total: Cents;
}

export function netWorthGroups(
    items: readonly NetWorthItem[],
    groups: readonly Group[],
): NetWorthGroup[] {
    const found: NetWorthGroup[] = [];

    for (const group of byPosition(groups)) {
        const members = items.filter((item) => item.groupId === group.id);
        if (members.length === 0) continue;
        found.push({ group, items: members, total: sumItems(members) });
    }

    return found;
}

export function owesMoney(total: Cents): boolean {
    return total < 0;
}

export function itemsInScope(
    groups: readonly NetWorthGroup[],
    scope: Scope,
): readonly NetWorthItem[] {
    if (scope !== ALL_GROUPS) {
        return groups.find((entry) => entry.group.id === scope)?.items ?? [];
    }

    return groups.map((entry) => ({
        id: entry.group.id,
        label: entry.group.name,
        groupId: entry.group.id,
        value: entry.total,
    }));
}

export interface AccountGroup {
    group: Group;
    accounts: readonly Account[];
    total: Cents;
}

export function accountsByGroup(
    accounts: readonly Account[],
    groups: readonly Group[],
): AccountGroup[] {
    const found: AccountGroup[] = [];

    for (const group of byPosition(groups)) {
        const members = accounts.filter((account) => account.groupId === group.id);
        if (members.length === 0) continue;
        found.push({ group, accounts: members, total: sumItems(netWorthItems(members, [])) });
    }

    return found;
}

export function lastSyncedAt(accounts: readonly Account[]): string | undefined {
    const stamps = accounts
        .map((account) => account.lastSyncedAt)
        .filter((stamp): stamp is string => stamp !== undefined)
        .sort();

    return stamps.at(-1);
}

export function byRecency(transactions: readonly Transaction[]): Transaction[] {
    return [...transactions].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}

export function forAccounts(
    transactions: readonly Transaction[],
    accountIds: ReadonlySet<string>,
): readonly Transaction[] {
    return transactions.filter(
        (transaction) =>
            accountIds.has(transaction.accountId) ||
            (transaction.toAccountId !== undefined && accountIds.has(transaction.toAccountId)),
    );
}

export function periodOf(occurredAt: string): string {
    return occurredAt.slice(0, 7);
}

export function latestPeriod(transactions: readonly Transaction[]): string | undefined {
    const first = byRecency(transactions).at(0);
    return first ? periodOf(first.occurredAt) : undefined;
}

export function inPeriod(
    transactions: readonly Transaction[],
    period: string,
): readonly Transaction[] {
    return transactions.filter((transaction) => periodOf(transaction.occurredAt) === period);
}

export interface BudgetProgress {
    limit: Cents;
    pct: number;
    over: boolean;
    gap: Cents;
}

export interface TagSpend {
    tagId?: string;
    label: string;
    spent: Cents;
    budget?: BudgetProgress;
}

export interface SpendSummary {
    period: string;
    tags: readonly TagSpend[];
    spent: Cents;
    budgeted: Cents;
    left: Cents;
}

const UNTAGGED = "";

function progress(spent: Cents, limit: Cents): BudgetProgress {
    const over = spent > limit;

    return {
        limit,
        pct: limit === 0 ? 0 : Math.min(100, Math.round((spent / limit) * 100)),
        over,
        gap: cents(Math.abs(spent - limit)),
    };
}

export function spendByTag(
    transactions: readonly Transaction[],
    budgets: readonly Budget[],
    tags: readonly Tag[],
    period: string,
): SpendSummary {
    const limits = new Map(budgets.map((budget) => [budget.tagId, budget.limit]));

    const totals = new Map<string, Cents>();
    for (const transaction of inPeriod(transactions, period)) {
        if (transaction.kind !== "expense") continue;
        const key = primaryTagId(transaction) ?? UNTAGGED;
        totals.set(key, cents((totals.get(key) ?? 0) + Math.abs(transaction.amount)));
    }

    const rows: TagSpend[] = [];
    for (const tag of [...tags].sort((one, other) => one.position - other.position)) {
        const spent = totals.get(tag.id) ?? cents(0);
        const limit = limits.get(tag.id);
        if (limit === undefined && spent === 0) continue;

        const row: TagSpend = { tagId: tag.id, label: tag.name, spent };
        if (limit !== undefined) row.budget = progress(spent, limit);
        rows.push(row);
    }

    const untagged = totals.get(UNTAGGED);
    if (untagged) rows.push({ label: "Untagged", spent: untagged });

    const spent = sumCents(rows.map((row) => row.spent));
    const budgeted = sumCents([...limits.values()]);

    return { period, tags: rows, spent, budgeted, left: cents(Math.max(0, budgeted - spent)) };
}

export function holdingsFor(
    holdings: readonly Holding[],
    accountId: string,
): readonly Holding[] {
    return holdings.filter((holding) => holding.accountId === accountId);
}
