import { useTags, useTransactions } from "@lofit/api";
import { ALL_GROUPS, byRecency, forAccounts } from "@lofit/domain";
import type { Account, Scope, Transaction } from "@lofit/domain";
import { useNavigate } from "../navigation";
import { useState } from "react";
import { useRemoveTransaction } from "../useRemoveTransaction";
import { EntrySheet } from "./entrySheet";
import { useToast } from "../toast";
import { TransactionRow } from "./transactionRow";

const STEP = 10;

type Props = {
    accounts: readonly Account[];
    scope: Scope;
};

export function RecentTransactions({ accounts, scope }: Props) {
    const [recentCount, setRecentCount] = useState(STEP);
    const { data: transactions, isPending, isError } = useTransactions();
    const { data: tags } = useTags();
    const navigate = useNavigate();
    const remove = useRemoveTransaction();
    const show = useToast();
    const [editing, setEditing] = useState<Transaction | null>(null);

    if (isPending) return null;
    if (isError) return <span className="kicker">Could not load activity</span>;

    const accountNames = new Map(accounts.map((account) => [account.id, account.name]));
    const tagNames = new Map((tags ?? []).map((tag) => [tag.id, tag.name]));
    const scoped =
        scope === ALL_GROUPS
            ? transactions
            : forAccounts(
                  transactions,
                  new Set(accounts.filter((account) => account.groupId === scope).map((a) => a.id)),
              );
    const recent = byRecency(scoped).slice(0, recentCount);

    return (
        <div className="section recent-section">
            <div className="section-head">
                <span className="kicker">Recent</span>
                <button
                    className="btn btn-ghost section-action"
                    onClick={() => navigate("spending")}
                >
                    All activity
                </button>
            </div>
            {recent.length === 0 ? (
                <span className="recent-empty">No activity on these accounts yet</span>
            ) : (
                <>
                    <div className="recent">
                        {recent.map((transaction) => (
                            <TransactionRow
                                key={transaction.id}
                                transaction={transaction}
                                accountNames={accountNames}
                                tagNames={tagNames}
                                onEdit={setEditing}
                                onDelete={remove}
                            />
                        ))}
                    </div>
                    {recentCount < scoped.length && (
                        <button
                            className="btn btn-ghost"
                            onClick={() => setRecentCount(recentCount + STEP)}
                            style={{ marginRight: "auto" }}
                        >
                            Load more
                        </button>
                    )}
                </>
            )}

            {editing && (
                <EntrySheet entry={editing} onClose={() => setEditing(null)} onSaved={show} />
            )}
        </div>
    );
}
