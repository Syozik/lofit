import { addCents, balanceChanges, dueDays, following } from "@lofit/domain";
import type { Recurring } from "@lofit/domain";
import { newId } from "./ids";
import type { Ledger, StoredRecurring } from "./store";

export function toRecurring(stored: StoredRecurring): Recurring {
    return { ...stored, shown: stored.amount };
}

export function logDue(data: Ledger, through: string): boolean {
    let logged = false;
    const known = new Set(data.tags.map((tag) => tag.id));

    data.recurring = data.recurring.map((item) => {
        if (item.paused) return item;
        const days = dueDays(item, through);
        if (days.length === 0) return item;

        for (const day of days) {
            const transaction = {
                id: newId(),
                name: item.name,
                kind: item.kind,
                tagIds: item.tagIds.filter((id) => known.has(id)),
                accountId: item.accountId,
                ...(item.toAccountId ? { toAccountId: item.toAccountId } : {}),
                amount: item.amount,
                occurredAt: `${day}T12:00:00.000Z`,
                createdAt: new Date().toISOString(),
            };
            data.transactions.push(transaction);
            for (const change of balanceChanges(transaction)) {
                data.accounts = data.accounts.map((account) =>
                    account.id === change.accountId
                        ? { ...account, balance: addCents(account.balance, change.delta) }
                        : account,
                );
            }
        }

        logged = true;
        return { ...item, nextDue: following(days.at(-1)!, item.cadence, item.anchor) };
    });

    return logged;
}
