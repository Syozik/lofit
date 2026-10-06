import { useTags, useTransactions } from "@lofit/api";
import { cents, forAccounts } from "@lofit/domain";
import type { Account, Transaction } from "@lofit/domain";
import { historyByMonth, signedAmount } from "@lofit/view";
import { useState } from "react";
import { monthName, yearOf } from "../period";
import { useToast } from "../toast";
import { useRemoveTransaction } from "../useRemoveTransaction";
import { EntrySheet } from "./entrySheet";
import { Sheet } from "./sheet";
import { TransactionRow } from "./transactionRow";

type ActivityProps = {
    account: Account;
    accounts: readonly Account[];
    onEdit: (transaction: Transaction) => void;
};

export function AccountActivity({ account, accounts, onEdit }: ActivityProps) {
    const transactions = useTransactions();
    const { data: tags } = useTags();
    const remove = useRemoveTransaction();

    if (transactions.isPending) return <span className="recent-empty">Loading…</span>;
    if (transactions.isError) return <span className="recent-empty">Could not load activity</span>;

    const accountNames = new Map(accounts.map((entry) => [entry.id, entry.name]));
    const tagNames = new Map((tags ?? []).map((tag) => [tag.id, tag.name]));
    const months = historyByMonth(
        forAccounts(transactions.data, new Set([account.id])),
        account.id,
    );
    const thisYear = new Date().getUTCFullYear().toString();

    if (months.length === 0) {
        return <span className="recent-empty">No activity on this account yet</span>;
    }

    return months.map((month) => (
        <div key={month.period} className="section recent-section tight">
            <div className="section-head">
                <span className="kicker">
                    {monthName(month.period, "long")}
                    {yearOf(month.period) === thisYear ? "" : ` ${yearOf(month.period)}`}
                </span>
                <span className={`history-net ${month.net > 0 ? "up" : ""}`}>
                    {signedAmount(cents(month.net))}
                </span>
            </div>
            <div className="recent">
                {month.entries.map((transaction) => (
                    <TransactionRow
                        key={transaction.id}
                        transaction={transaction}
                        accountNames={accountNames}
                        tagNames={tagNames}
                        onEdit={onEdit}
                        onDelete={remove}
                        viewedFrom={account.id}
                    />
                ))}
            </div>
        </div>
    ));
}

type Props = {
    account: Account;
    accounts: readonly Account[];
    onClose: () => void;
};

export function AccountHistory({ account, accounts, onClose }: Props) {
    const transactions = useTransactions();
    const show = useToast();
    const [editing, setEditing] = useState<Transaction | null>(null);
    const count = forAccounts(transactions.data ?? [], new Set([account.id])).length;

    return (
        <>
            <Sheet label={`${account.name} history`} onClose={onClose}>
                <div className="sheet-head">
                    <h4 className="sheet-title">{account.name}</h4>
                    <span className="sheet-note">
                        {count} {count === 1 ? "entry" : "entries"}
                    </span>
                </div>

                <AccountActivity account={account} accounts={accounts} onEdit={setEditing} />
            </Sheet>

            {editing && (
                <EntrySheet entry={editing} onClose={() => setEditing(null)} onSaved={show} />
            )}
        </>
    );
}
