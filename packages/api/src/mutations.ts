import { balanceChanges, negateCents } from "@lofit/domain";
import type { Account, BalanceChange, Budget, Group, TagKind, NewAccount, NewTransaction, Tag, Transaction } from "@lofit/domain";
import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { addAccount, updateAccountBalance } from "./accounts";
import { setBudget } from "./budgets";
import type { BudgetChange } from "./budgets";
import { ApiError, isUnreachable } from "./client";
import { addGroup } from "./groups";
import { addTag, renameTag } from "./tags";
import { addTransaction, deleteTransaction, updateTransaction } from "./transactions";

export const MUTATIONS = {
    addTransaction: ["transactions", "add"],
    updateTransaction: ["transactions", "update"],
    deleteTransaction: ["transactions", "delete"],
    updateBalance: ["accounts", "balance"],
    addAccount: ["accounts", "add"],
    addTag: ["tags", "add"],
    renameTag: ["tags", "rename"],
    addGroup: ["groups", "add"],
    setBudget: ["budgets", "set"],
} as const;

export type TransactionDraft = NewTransaction & { id: string };
export type TransactionUpdate = { id: string; draft: NewTransaction };
export type BalanceUpdate = { id: string; balance: number };
export type AccountDraft = NewAccount & { id: string };
export type NamedDraft = { id: string; name: string };
export type TagDraft = NamedDraft & { kind: TagKind };

const SYNC = { id: "lofit-sync" };

function toTransaction(id: string, draft: NewTransaction): Transaction {
    const transaction: Transaction = {
        id,
        name: draft.name,
        kind: draft.kind,
        tagIds: [...draft.tagIds],
        accountId: draft.accountId,
        amount: draft.amount,
        occurredAt: draft.occurredAt,
    };
    if (draft.toAccountId) transaction.toAccountId = draft.toAccountId;
    if (draft.currency) transaction.original = { amount: draft.amount, currency: draft.currency };
    return transaction;
}

function shifts(transaction: Transaction): readonly BalanceChange[] {
    return transaction.original ? [] : balanceChanges(transaction);
}

function shiftBalances(client: QueryClient, changes: readonly BalanceChange[], direction: 1 | -1): void {
    client.setQueryData<readonly Account[]>(["accounts"], (accounts) =>
        accounts?.map((account) => {
            const delta = changes
                .filter((change) => change.accountId === account.id)
                .reduce((sum, change) => sum + (direction === 1 ? change.delta : negateCents(change.delta)), 0);
            return delta === 0 ? account : { ...account, balance: (account.balance + delta) as Account["balance"] };
        }),
    );
}

function nextPosition(items: readonly { position: number }[] | undefined): number {
    return (items ?? []).reduce((max, item) => Math.max(max, item.position + 1), 0);
}

export function configureMutations(client: QueryClient): void {
    const retry = (_count: number, error: Error) => isUnreachable(error);

    const hold = async (...keys: string[]) => {
        await Promise.all(keys.map((key) => client.cancelQueries({ queryKey: [key] })));
    };

    const settle = (...keys: string[]) => async () => {
        if (client.isMutating() > 1) return;
        await Promise.all(keys.map((key) => client.invalidateQueries({ queryKey: [key] })));
    };

    const register = <Variables, Result>(
        key: QueryKey,
        mutationFn: (variables: Variables) => Promise<Result>,
        onMutate: (variables: Variables) => Promise<void> | void,
        keys: string[],
    ) => {
        client.setMutationDefaults(key, {
            mutationFn: mutationFn as (variables: unknown) => Promise<unknown>,
            onMutate: onMutate as (variables: unknown) => Promise<void> | void,
            onSettled: settle(...keys),
            retry,
            scope: SYNC,
        });
    };

    register<TransactionDraft, Transaction>(
        MUTATIONS.addTransaction,
        addTransaction,
        async (draft) => {
            await hold("transactions", "accounts");
            const transaction = toTransaction(draft.id, draft);
            client.setQueryData<readonly Transaction[]>(["transactions"], (all) =>
                all?.some((entry) => entry.id === draft.id) ? all : [transaction, ...(all ?? [])],
            );
            shiftBalances(client, shifts(transaction), 1);
        },
        ["transactions", "accounts"],
    );

    register<TransactionUpdate, Transaction>(
        MUTATIONS.updateTransaction,
        updateTransaction,
        async ({ id, draft }) => {
            await hold("transactions", "accounts");
            const current = client.getQueryData<readonly Transaction[]>(["transactions"])?.find((entry) => entry.id === id);
            const next = toTransaction(id, draft);
            if (current && !next.original) shiftBalances(client, balanceChanges(current), -1);
            shiftBalances(client, shifts(next), 1);
            client.setQueryData<readonly Transaction[]>(["transactions"], (all) =>
                all?.map((entry) => (entry.id === id ? next : entry)),
            );
        },
        ["transactions", "accounts"],
    );

    register<string, void>(
        MUTATIONS.deleteTransaction,
        async (id) => {
            try {
                await deleteTransaction(id);
            } catch (error) {
                if (error instanceof ApiError && error.status === 404) return;
                throw error;
            }
        },
        async (id) => {
            await hold("transactions", "accounts");
            const current = client.getQueryData<readonly Transaction[]>(["transactions"])?.find((entry) => entry.id === id);
            if (current) shiftBalances(client, balanceChanges(current), -1);
            client.setQueryData<readonly Transaction[]>(["transactions"], (all) => all?.filter((entry) => entry.id !== id));
        },
        ["transactions", "accounts"],
    );

    register<BalanceUpdate, Account>(
        MUTATIONS.updateBalance,
        updateAccountBalance,
        async ({ id, balance }) => {
            await hold("accounts");
            const statedAt = new Date().toISOString();
            client.setQueryData<readonly Account[]>(["accounts"], (accounts) =>
                accounts?.map((account) =>
                    account.id === id ? { ...account, balance: balance as Account["balance"], statedAt } : account,
                ),
            );
        },
        ["accounts"],
    );

    register<AccountDraft, Account>(
        MUTATIONS.addAccount,
        addAccount,
        async (draft) => {
            await hold("accounts");
            const account: Account = {
                id: draft.id,
                name: draft.name,
                subtitle: draft.subtitle,
                groupId: draft.groupId,
                balance: draft.balance,
                provenance: "manual",
                statedAt: new Date().toISOString(),
            };
            client.setQueryData<readonly Account[]>(["accounts"], (accounts) =>
                accounts?.some((entry) => entry.id === draft.id) ? accounts : [...(accounts ?? []), account],
            );
        },
        ["accounts"],
    );

    register<TagDraft, Tag>(
        MUTATIONS.addTag,
        addTag,
        async (draft) => {
            await hold("tags");
            client.setQueryData<readonly Tag[]>(["tags"], (tags) =>
                tags?.some((tag) => tag.id === draft.id)
                    ? tags
                    : [...(tags ?? []), { id: draft.id, name: draft.name, kind: draft.kind, position: nextPosition(tags) }],
            );
        },
        ["tags"],
    );

    register<NamedDraft, Tag>(
        MUTATIONS.renameTag,
        renameTag,
        async ({ id, name }) => {
            await hold("tags");
            client.setQueryData<readonly Tag[]>(["tags"], (tags) => tags?.map((tag) => (tag.id === id ? { ...tag, name } : tag)));
        },
        ["tags"],
    );

    register<NamedDraft, Group>(
        MUTATIONS.addGroup,
        addGroup,
        async (draft) => {
            await hold("groups");
            client.setQueryData<readonly Group[]>(["groups"], (groups) =>
                groups?.some((group) => group.id === draft.id)
                    ? groups
                    : [...(groups ?? []), { id: draft.id, name: draft.name, position: nextPosition(groups), invests: false }],
            );
        },
        ["groups"],
    );

    register<BudgetChange, void>(
        MUTATIONS.setBudget,
        setBudget,
        async ({ tagId, limit }) => {
            await hold("budgets");
            client.setQueryData<readonly Budget[]>(["budgets"], (budgets) => {
                const others = (budgets ?? []).filter((budget) => budget.tagId !== tagId);
                return limit === null ? others : [...others, { tagId, limit }];
            });
        },
        ["budgets"],
    );
}
