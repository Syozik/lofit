import { useAccounts, useBudgets, useTags, useTransactions } from "@lofit/api";
import {
    byRecency,
    earliestPeriod,
    formatAmount,
    inPeriod,
    periodOf,
    shiftPeriod,
    spendByTag,
    tagsFor,
    withSymbol,
} from "@lofit/domain";
import type { Cents, Transaction } from "@lofit/domain";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useState } from "react";
import { useRemoveTransaction } from "../useRemoveTransaction";
import {
    budgetStatus,
    filterOptions,
    filterTransactions,
    isFiltered,
    litSlices,
    matchedKeys,
    monthName,
    NO_FILTER,
    shortMoney,
    spendSlices,
    toggled,
    toggledAll,
    UNTAGGED_KEY,
} from "@lofit/view";
import type { BudgetStatus, FilterOption, SpendFilter } from "@lofit/view";
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

function Meter({ status }: { status: BudgetStatus }) {
    return (
        <div className="spend-bar">
            <div className={`spend-fill ${status.state}`} style={{ width: `${status.pct}%` }} />
            {status.pace !== undefined && (
                <div
                    className="spend-pace"
                    title="Today"
                    style={{ left: `${Math.round(status.pace * 100)}%` }}
                />
            )}
        </div>
    );
}

function BudgetBar({ spent, limit, period }: { spent: Cents; limit: Cents; period: string }) {
    const status = budgetStatus(spent, limit, period);
    return (
        <>
            <Meter status={status} />
            <div className="spend-cat-foot">
                <span className="spend-cat-limit">of {withSymbol(formatAmount(limit))}</span>
                <span className={`spend-note ${status.state}`}>{status.note}</span>
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

function FilterBar({
    filter,
    options,
    onChange,
}: {
    filter: SpendFilter;
    options: { tags: FilterOption[]; accounts: FilterOption[] };
    onChange: (filter: SpendFilter) => void;
}) {
    return (
        <div className="spend-filters">
            <label className="spend-search">
                <Search size={14} strokeWidth={1.5} aria-hidden />
                <input
                    className="input"
                    type="search"
                    aria-label="Search this month"
                    placeholder="Name, tag, or account"
                    value={filter.query}
                    onChange={(event) => onChange({ ...filter, query: event.target.value })}
                />
            </label>
            <div className="spend-filter-chips">
                {options.tags.map((option) => (
                    <button
                        key={option.id}
                        className={`tag sheet-chip ${filter.tagIds.includes(option.id) ? "selected" : ""}`}
                        aria-pressed={filter.tagIds.includes(option.id)}
                        onClick={() => onChange({ ...filter, tagIds: toggled(filter.tagIds, option.id) })}
                    >
                        {option.label}
                    </button>
                ))}
                {options.accounts.length > 1 && <span className="spend-filter-sep" aria-hidden />}
                {options.accounts.length > 1 &&
                    options.accounts.map((option) => (
                        <button
                            key={option.id}
                            className={`tag sheet-chip ${filter.accountIds.includes(option.id) ? "selected" : ""}`}
                            aria-pressed={filter.accountIds.includes(option.id)}
                            onClick={() =>
                                onChange({ ...filter, accountIds: toggled(filter.accountIds, option.id) })
                            }
                        >
                            {option.label}
                        </button>
                    ))}
                {isFiltered(filter) && (
                    <button className="btn btn-ghost section-action" onClick={() => onChange(NO_FILTER)}>
                        Clear
                    </button>
                )}
            </div>
        </div>
    );
}

export function SpendingTab() {
    const remove = useRemoveTransaction();
    const show = useToast();
    const desktop = useDesktop();
    const [editing, setEditing] = useState<Transaction | null>(null);
    const [filter, setFilter] = useState<SpendFilter>(NO_FILTER);
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
    }

    const expenseTags = tagsFor(tags.data, "expense");
    const expenseBudgets = budgets.data.filter((budget) =>
        expenseTags.some((tag) => tag.id === budget.tagId),
    );
    const accountNames = new Map(accounts.data.map((account) => [account.id, account.name]));
    const tagNames = new Map(tags.data.map((tag) => [tag.id, tag.name]));
    const monthly = inPeriod(transactions.data, period);
    const filtered = isFiltered(filter);
    const shown = filtered ? filterTransactions(monthly, filter, tagNames, accountNames) : monthly;
    const options = filterOptions(monthly, tags.data, accountNames, filter);
    const summary = spendByTag(monthly, expenseBudgets, tags.data, period);
    const matching = spendByTag(shown, expenseBudgets, tags.data, period);
    const matched = matchedKeys(matching);
    const { slices, tagsOf } = spendSlices(summary.tags, tags.data);
    const lit = filtered ? litSlices(tagsOf, matched) : undefined;
    const activity = byRecency(shown);
    const budgeted = summary.tags.flatMap((row) => (row.budget ? [{ ...row, budget: row.budget }] : []));
    const total = budgetStatus(summary.spent, summary.budgeted, period);

    function focusSlice(key: string | null) {
        const group = key ? tagsOf.get(key) : undefined;
        setFilter({ ...filter, tagIds: group ? toggledAll(filter.tagIds, group) : [] });
    }

    function toggleTag(tagId: string) {
        setFilter({ ...filter, tagIds: toggled(filter.tagIds, tagId) });
    }

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
                        <span className="spend-amount">{withSymbol(formatAmount(summary.spent))}</span>
                    </div>
                    {desktop ? (
                        <div className="spend-budget">
                            {summary.budgeted > 0 ? (
                                <>
                                    <Meter status={total} />
                                    <span className="spend-of">
                                        of {withSymbol(formatAmount(summary.budgeted))}
                                    </span>
                                    <span className={`spend-left ${total.state}`}>{total.note}</span>
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
                                    <Meter status={total} />
                                    <span className="spend-of">
                                        of {withSymbol(formatAmount(summary.budgeted))}
                                    </span>
                                    <span className={`spend-left ${total.state}`}>{total.note}</span>
                                </>
                            ) : (
                                <span className="spend-left">Set a budget</span>
                            )}
                        </button>
                    )}
                </div>

                <FilterBar filter={filter} options={options} onChange={setFilter} />

                <div className="spend-split">
                    <div className="spend-side">
                        {slices.length > 0 && (
                            <div className="panel spend-mix">
                                {desktop && <span className="kicker">By category</span>}
                                <Donut
                                    slices={slices}
                                    focused={null}
                                    lit={lit}
                                    onFocus={focusSlice}
                                    label={filtered ? "Matching" : "Spent"}
                                    value={shortMoney(filtered ? matching.spent : summary.spent)}
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
                                <button
                                    key={row.tagId ?? "untagged"}
                                    className={`spend-cat spend-cat-button ${filter.tagIds.includes(row.tagId ?? UNTAGGED_KEY) ? "selected" : ""} ${filtered && !matched.has(row.tagId ?? UNTAGGED_KEY) ? "dimmed" : ""}`}
                                    aria-pressed={filter.tagIds.includes(row.tagId ?? UNTAGGED_KEY)}
                                    onClick={() => toggleTag(row.tagId ?? UNTAGGED_KEY)}
                                >
                                    <div className="spend-cat-head">
                                        <span className="spend-cat-name">{row.label}</span>
                                        <span className="spend-cat-spent">
                                            {withSymbol(formatAmount(row.spent))}
                                        </span>
                                    </div>
                                    <BudgetBar spent={row.spent} limit={row.budget.limit} period={period} />
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="section recent-section tight panel">
                        <div className="section-head">
                            <span className="kicker">{filtered ? "Matching activity" : "All activity"}</span>
                            {filtered && (
                                <button
                                    className="btn btn-ghost section-action"
                                    onClick={() => setFilter(NO_FILTER)}
                                >
                                    Show all
                                </button>
                            )}
                        </div>
                        <div className="recent">
                            {activity.length === 0 && (
                                <span className="recent-empty">
                                    {filtered
                                        ? `Nothing in ${monthName(period, "long")} matches`
                                        : `No activity in ${monthName(period, "long")}`}
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
                                    onTag={toggleTag}
                                    selectedTags={filter.tagIds}
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
