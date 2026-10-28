import type { Account, Transaction } from "@lofit/domain";
import type { StoredAccount, StoredTransaction } from "./store";

export function toAccount(stored: StoredAccount): Account {
    const { createdAt: _, ...account } = stored;
    return account;
}

export function toTransaction(stored: StoredTransaction): Transaction {
    const { createdAt: _, ...transaction } = stored;
    return transaction;
}
