import { useAccounts, useBudgets, useTags, useTransactions } from "@lofit/api";
import { byRecency, formatAmount, latestPeriod, primaryTagId, spendByTag } from "@lofit/domain";
import type { Transaction } from "@lofit/domain";
import { useState } from "react";
import { useRemoveTransaction } from "../useRemoveTransaction";
import { spendSlices, UNTAGGED_KEY } from "@lofit/view";
import { Donut } from "./donut";
import { EntrySheet } from "./entrySheet";
import { useToast } from "../toast";
import { TransactionRow } from "./transactionRow";

const monthFormat = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
});

function formatPeriod(period: string): string {
    return monthFormat.format(new Date(`${period}-01T00:00:00Z`));
}

// function BudgetBar({ budget }: { budget: BudgetProgress }) {
//     return (
//         <>
//             <div className="spend-bar">
//                 <div
//                     className={`spend-fill ${budget.over ? "over" : ""}`}
//                     style={{ width: `${budget.pct}%` }}
//                 />
//             </div>
//             <span className={`spend-note ${budget.over ? "over" : ""}`}>
//                 € {formatAmount(budget.gap)} {budget.over ? "over budget" : "left"}
//             </span>
//         </>
//     );
// }
//
export function SpendingTab() {
    const remove = useRemoveTransaction();
    const show = useToast();
    const [editing, setEditing] = useState<Transaction | null>(null);
    const [focused, setFocused] = useState<string | null>(null);
    const transactions = useTransactions();
    const budgets = useBudgets();
    const accounts = useAccounts();
    const tags = useTags();

    if (transactions.isPending || budgets.isPending || accounts.isPending || tags.isPending) {
        return <div className="tab-content">Loading…</div>;
    }
    if (transactions.isError || budgets.isError || accounts.isError || tags.isError) {
        return <div className="tab-content">Could not load spending</div>;
    }

    const period = latestPeriod(transactions.data);
    if (!period) return <div className="tab-content">No activity yet</div>;

    const summary = spendByTag(transactions.data, budgets.data, tags.data, period);
    const accountNames = new Map(accounts.data.map((account) => [account.id, account.name]));
    const tagNames = new Map(tags.data.map((tag) => [tag.id, tag.name]));
    const { slices, tagsOf } = spendSlices(summary.tags, tags.data);
    const focusedTags = focused ? tagsOf.get(focused) : undefined;
    const activity = byRecency(
        focusedTags
            ? transactions.data.filter((transaction) =>
                  focusedTags.has(primaryTagId(transaction) ?? UNTAGGED_KEY),
              )
            : transactions.data,
    );
    const focusedLabel = slices.find((slice) => slice.key === focused)?.label;

    return (
        <div className="tab-content">
            <div className="spending">
                <div className="spend-head">
                    <div className="spend-total">
                        <span className="kicker">Spent in {formatPeriod(period)}</span>
                        <span className="spend-amount">€ {formatAmount(summary.spent)}</span>
                    </div>
                    <div className="spend-budget">
                        <span className="spend-of">of € {formatAmount(summary.budgeted)}</span>
                        <span className="spend-left">€ {formatAmount(summary.left)} left</span>
                    </div>
                </div>

                {slices.length > 0 && (
                    <Donut
                        slices={slices}
                        focused={focusedTags ? focused : null}
                        onFocus={setFocused}
                        label="Spent"
                        value={`€ ${Math.round(summary.spent / 100).toLocaleString("en-US")}`}
                    />
                )}

                {/*<div className="spend-cats">
                    {summary.tags.map((row) => (
                        <div key={row.tagId ?? "untagged"} className="spend-cat">
                            <div className="spend-cat-head">
                                <span>{row.label}</span>
                                <span className="spend-cat-spent">€ {formatAmount(row.spent)}</span>
                                {row.budget && (
                                    <span className="spend-cat-limit">
                                        / € {formatAmount(row.budget.limit)}
                                    </span>
                                )}
                            </div>
                            {row.budget ? (
                                <BudgetBar budget={row.budget} />
                            ) : (
                                <span className="spend-note">No budget</span>
                            )}
                        </div>
                    ))}
                </div>*/}

                <div className="section recent-section tight">
                    <div className="section-head">
                        <span className="kicker">{focusedLabel && focusedTags ? focusedLabel : "All activity"}</span>
                        {focusedTags && (
                            <button className="btn btn-ghost section-action" onClick={() => setFocused(null)}>
                                Show all
                            </button>
                        )}
                    </div>
                    <div className="recent">
                        {activity.map((transaction) => (
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
                </div>
            </div>

            {editing && (
                <EntrySheet entry={editing} onClose={() => setEditing(null)} onSaved={show} />
            )}
        </div>
    );
}
