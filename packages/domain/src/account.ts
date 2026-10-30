import { addCents, cents, negateCents } from "./money";
import type { Cents, Currency } from "./money";
import type { AccountChange, AccountDetail, Provenance } from "./types";

export interface Account {
    id: string;
    name: string;
    subtitle: string;
    groupId: string;
    balance: Cents;
    currency: Currency;
    nativeBalance: Cents;
    provenance: Provenance;
    lastSyncedAt?: string;
    statedAt?: string;
    change?: AccountChange;
    details?: readonly AccountDetail[];
}

export interface NewAccount {
    id?: string;
    name: string;
    subtitle: string;
    groupId: string;
    balance: Cents;
    currency?: Currency;
}

export function withBalance(account: Account, balance: Cents): Account {
    return { ...account, balance };
}

const dayFormat = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
});

export function sinceLabel(instant: string): string {
    return `since ${dayFormat.format(new Date(instant))}`;
}

export function restated(account: Account, balance: Cents, at: string, since: string): Account {
    const amount = addCents(balance, negateCents(account.balance));

    return {
        ...account,
        balance,
        statedAt: at,
        change: { amount, period: sinceLabel(since), favourable: amount >= cents(0) },
    };
}
