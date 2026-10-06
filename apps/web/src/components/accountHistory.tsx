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
    const months = historyByMonth(mine, account.id);
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
                                    {yearOf(month.period) === thisYear
                                        ? ""
                                        : ` ${yearOf(month.period)}`}
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

            {editing && (
                <EntrySheet entry={editing} onClose={() => setEditing(null)} onSaved={show} />
            )}
        </>
    );
}
