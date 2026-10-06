import { useTags, useTransactions } from "@lofit/api";
import { balanceChanges, byRecency, formatAmount, forAccounts, periodOf } from "@lofit/domain";
import type { Account, Cents, Transaction } from "@lofit/domain";
import { useState } from "react";
import { monthName, yearOf } from "../period";
import { useToast } from "../toast";
import { useRemoveTransaction } from "../useRemoveTransaction";
import { EntrySheet } from "./entrySheet";
import { Sheet } from "./sheet";
import { TransactionRow } from "./transactionRow";

type Month = {
    period: string;
    net: number;
    entries: Transaction[];
};

function deltaFor(transaction: Transaction, accountId: string): number {
    return balanceChanges(transaction)
        .filter((change) => change.accountId === accountId)
        .reduce((sum, change) => sum + change.delta, 0);
}

function byMonth(transactions: readonly Transaction[], accountId: string): Month[] {
    const months: Month[] = [];
    for (const transaction of byRecency(transactions)) {
        const period = periodOf(transaction.occurredAt);
        let month = months[months.length - 1];
        if (!month || month.period !== period) {
            month = { period, net: 0, entries: [] };
            months.push(month);
        }
        month.entries.push(transaction);
        month.net += deltaFor(transaction, accountId);
    }
    return months;
}

function signed(amount: number): string {
    return `${amount < 0 ? "−" : "+"} € ${formatAmount(Math.abs(amount) as Cents)}`;
}

type Props = {
    account: Account;
    accounts: readonly Account[];
    onClose: () => void;
};

export function AccountHistory({ account, accounts, onClose }: Props) {
    const transactions = useTransactions();
    const { data: tags } = useTags();
    const remove = useRemoveTransaction();
    const show = useToast();
    const [editing, setEditing] = useState<Transaction | null>(null);

    const accountNames = new Map(accounts.map((entry) => [entry.id, entry.name]));
    const tagNames = new Map((tags ?? []).map((tag) => [tag.id, tag.name]));
    const mine = forAccounts(transactions.data ?? [], new Set([account.id]));
    const months = byMonth(mine, account.id);
    const thisYear = new Date().getUTCFullYear().toString();

    return (
        <>
            <Sheet label={`${account.name} history`} onClose={onClose}>
                <div className="sheet-head">
                    <h4 className="sheet-title">{account.name}</h4>
                    <span className="sheet-note">
                        {mine.length} {mine.length === 1 ? "entry" : "entries"}
                    </span>
                </div>

                {transactions.isPending ? (
                    <span className="recent-empty">Loading…</span>
                ) : transactions.isError ? (
                    <span className="recent-empty">Could not load activity</span>
                ) : months.length === 0 ? (
                    <span className="recent-empty">No activity on this account yet</span>
                ) : (
                    months.map((month) => (
                        <div key={month.period} className="section recent-section tight">
                            <div className="section-head">
                                <span className="kicker">
                                    {monthName(month.period, "long")}
                                    {yearOf(month.period) === thisYear ? "" : ` ${yearOf(month.period)}`}
                                </span>
                                <span className={`history-net ${month.net > 0 ? "up" : ""}`}>
                                    {signed(month.net)}
                                </span>
                            </div>
                            <div className="recent">
                                {month.entries.map((transaction) => (
                                    <TransactionRow
                                        key={transaction.id}
                                        transaction={transaction}
                                        accountNames={accountNames}
                                        tagNames={tagNames}
                                        onEdit={setEditing}
                                        onDelete={remove}
                                        viewedFrom={account.id}
                                    />
                                ))}
                            </div>
                        </div>
                    ))
                )}
            </Sheet>

            {editing && <EntrySheet entry={editing} onClose={() => setEditing(null)} onSaved={show} />}
        </>
    );
}
