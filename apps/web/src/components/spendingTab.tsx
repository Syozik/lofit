import { useAccounts, useBudgets, useTags, useTransactions } from "@lofit/api";
import { byRecency, formatAmount, latestPeriod, primaryTagId, spendByTag } from "@lofit/domain";
import type { BudgetProgress, Transaction } from "@lofit/domain";
import { useState } from "react";
import { useRemoveTransaction } from "../useRemoveTransaction";
import { spendSlices, UNTAGGED_KEY } from "@lofit/view";
import { Donut } from "./donut";
import { EntrySheet } from "./entrySheet";
import { useToast } from "../toast";
import { useDesktop } from "../useDesktop";
import { TransactionRow } from "./transactionRow";

const monthFormat = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
});

function formatPeriod(period: string): string {
    return monthFormat.format(new Date(`${period}-01T00:00:00Z`));
}

function Meter({ pct, over }: { pct: number; over: boolean }) {
    return (
        <div className="spend-bar">
            <div className={`spend-fill ${over ? "over" : ""}`} style={{ width: `${pct}%` }} />
        </div>
    );
}

function BudgetBar({ budget }: { budget: BudgetProgress }) {
    return (
        <>
            <Meter pct={budget.pct} over={budget.over} />
            <div className="spend-cat-foot">
                <span className="spend-cat-limit">of € {formatAmount(budget.limit)}</span>
                <span className={`spend-note ${budget.over ? "over" : ""}`}>
                    € {formatAmount(budget.gap)} {budget.over ? "over" : "left"}
                </span>
            </div>
        </>
    );
}

export function SpendingTab() {
    const remove = useRemoveTransaction();
    const show = useToast();
    const desktop = useDesktop();
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
    const budgeted = summary.tags.flatMap((row) =>
        row.budget ? [{ ...row, budget: row.budget }] : [],
    );
    const focusedLabel = slices.find((slice) => slice.key === focused)?.label;
    const budgetPct = Math.min(100, Math.round((summary.spent / summary.budgeted) * 100));

    return (
        <div className="tab-content">
            <div className="spending">
                <div className="spend-head">
                    <div className="spend-total">
                        <span className="kicker">Spent in {formatPeriod(period)}</span>
                        <span className="spend-amount">€ {formatAmount(summary.spent)}</span>
                    </div>
                    <div className="spend-budget">
                        {desktop && summary.budgeted > 0 && (
                            <Meter pct={budgetPct} over={summary.spent > summary.budgeted} />
                        )}
                        <span className="spend-of">of € {formatAmount(summary.budgeted)}</span>
                        <span className="spend-left">€ {formatAmount(summary.left)} left</span>
                    </div>
                </div>

                <div className="spend-split">
                    <div className="spend-side">
                        {slices.length > 0 && (
                            <div className="panel spend-mix">
                                {desktop && <span className="kicker">By category</span>}
                                <Donut
                                    slices={slices}
                                    focused={focusedTags ? focused : null}
                                    onFocus={setFocused}
                                    label="Spent"
                                    value={`€ ${Math.round(summary.spent / 100).toLocaleString("en-US")}`}
                                />
                            </div>
                        )}
                        {budgeted.length > 0 && (
                            <div className="panel spend-cats">
                                <span className="kicker">Budgets</span>
                                {budgeted.map((row) => (
                                    <div key={row.tagId ?? "untagged"} className="spend-cat">
                                        <div className="spend-cat-head">
                                            <span className="spend-cat-name">{row.label}</span>
                                            <span className="spend-cat-spent">
                                                € {formatAmount(row.spent)}
                                            </span>
                                        </div>
                                        <BudgetBar budget={row.budget} />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="section recent-section tight panel">
                        <div className="section-head">
                            <span className="kicker">
                                {focusedLabel && focusedTags ? focusedLabel : "All activity"}
                            </span>
                            {focusedTags && (
                                <button
                                    className="btn btn-ghost section-action"
                                    onClick={() => setFocused(null)}
                                >
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
            </div>

            {editing && (
                <EntrySheet entry={editing} onClose={() => setEditing(null)} onSaved={show} />
            )}
        </div>
    );
}
