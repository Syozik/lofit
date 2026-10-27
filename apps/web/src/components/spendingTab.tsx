import { useAccounts, useBudgets, useTags, useTransactions } from "@lofit/api";
import {
    byRecency,
    earliestPeriod,
    formatAmount,
    inPeriod,
    periodOf,
    primaryTagId,
    shiftPeriod,
    spendByTag,
} from "@lofit/domain";
import type { BudgetProgress, Transaction } from "@lofit/domain";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { useRemoveTransaction } from "../useRemoveTransaction";
import { monthName, spendSlices, UNTAGGED_KEY } from "@lofit/view";
import { BudgetSheet } from "./budgetSheet";
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

function currentPeriod(): string {
    return periodOf(new Date().toISOString());
}

function MonthStep({
    period,
    earliest,
    latest,
    onChange,
}: {
    period: string;
    earliest: string;
    latest: string;
    onChange: (period: string) => void;
}) {
    return (
        <span className="spend-period">
            <span className="kicker spend-month" data-widest={`September ${period.slice(0, 4)}`}>
                <span>{formatPeriod(period)}</span>
            </span>
            <button
                className="btn btn-ghost btn-icon spend-step"
                aria-label="Previous month"
                disabled={period <= earliest}
                onClick={() => onChange(shiftPeriod(period, -1))}
            >
                <ChevronLeft size={16} strokeWidth={1.5} aria-hidden />
            </button>
            <button
                className="btn btn-ghost btn-icon spend-step"
                aria-label="Next month"
                disabled={period >= latest}
                onClick={() => onChange(shiftPeriod(period, 1))}
            >
                <ChevronRight size={16} strokeWidth={1.5} aria-hidden />
            </button>
        </span>
    );
}

export function SpendingTab() {
    const remove = useRemoveTransaction();
    const show = useToast();
    const desktop = useDesktop();
    const [editing, setEditing] = useState<Transaction | null>(null);
    const [focused, setFocused] = useState<string | null>(null);
    const [period, setPeriod] = useState(currentPeriod);
    const [budgeting, setBudgeting] = useState(false);
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

    const latest = currentPeriod();
    const earliest = earliestPeriod(transactions.data) ?? latest;

    function step(next: string) {
        setPeriod(next);
        setFocused(null);
    }

    const summary = spendByTag(transactions.data, budgets.data, tags.data, period);
    const accountNames = new Map(accounts.data.map((account) => [account.id, account.name]));
    const tagNames = new Map(tags.data.map((tag) => [tag.id, tag.name]));
    const { slices, tagsOf } = spendSlices(summary.tags, tags.data);
    const focusedTags = focused ? tagsOf.get(focused) : undefined;
    const monthly = inPeriod(transactions.data, period);
    const activity = byRecency(
        focusedTags
            ? monthly.filter((transaction) =>
                  focusedTags.has(primaryTagId(transaction) ?? UNTAGGED_KEY),
              )
            : monthly,
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
                        <MonthStep
                            period={period}
                            earliest={earliest}
                            latest={latest}
                            onChange={step}
                        />
                        <span className="spend-amount">€ {formatAmount(summary.spent)}</span>
                    </div>
                    {desktop ? (
                        <div className="spend-budget">
                            {summary.budgeted > 0 ? (
                                <>
                                    <Meter
                                        pct={budgetPct}
                                        over={summary.spent > summary.budgeted}
                                    />
                                    <span className="spend-of">
                                        of € {formatAmount(summary.budgeted)}
                                    </span>
                                    <span className="spend-left">
                                        € {formatAmount(summary.left)} left
                                    </span>
                                </>
                            ) : (
                                <span className="spend-of">No budget set</span>
                            )}
                        </div>
                    ) : (
                        <button
                            className="spend-budget spend-budget-button"
                            onClick={() => setBudgeting(true)}
                        >
                            {summary.budgeted > 0 ? (
                                <>
                                    <span className="spend-of">
                                        of € {formatAmount(summary.budgeted)}
                                    </span>
                                    <span className="spend-left">
                                        € {formatAmount(summary.left)} left
                                    </span>
                                </>
                            ) : (
                                <span className="spend-left">Set a budget</span>
                            )}
                        </button>
                    )}
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
                        <div className="panel spend-cats">
                            <div className="section-head">
                                <span className="kicker">Budgets</span>
                                {budgeted.length > 0 && (
                                    <button
                                        className="btn btn-ghost section-action"
                                        onClick={() => setBudgeting(true)}
                                    >
                                        Edit
                                    </button>
                                )}
                            </div>
                            {budgeted.length === 0 && (
                                <div className="spend-cats-empty">
                                    <span className="recent-empty">No budgets yet</span>
                                    <button
                                        className="btn btn-secondary"
                                        onClick={() => setBudgeting(true)}
                                    >
                                        Set budgets
                                    </button>
                                </div>
                            )}
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
                            {activity.length === 0 && (
                                <span className="recent-empty">
                                    No activity in {monthName(period, "long")}
                                </span>
                            )}
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

            {budgeting && (
                <BudgetSheet period={period} onClose={() => setBudgeting(false)} onSaved={show} />
            )}
            {editing && (
                <EntrySheet entry={editing} onClose={() => setEditing(null)} onSaved={show} />
            )}
        </div>
    );
}
