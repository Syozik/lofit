import { displayCurrency } from "@lofit/domain";
import type { Account, Transaction } from "@lofit/domain";
import type { StoredAccount, StoredTransaction } from "./store";

export function toAccount(stored: StoredAccount): Account {
    const { createdAt: _, ...account } = stored;
    return { ...account, currency: displayCurrency(), nativeBalance: account.balance };
}

export function toTransaction(stored: StoredTransaction): Transaction {
    const { createdAt: _, ...transaction } = stored;
    return transaction;
}
