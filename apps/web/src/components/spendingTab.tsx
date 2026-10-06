import { useAccounts, useBudgets, useTags, useTransactions } from "@lofit/api";
import { byRecency, cents, formatAmount, latestPeriod, primaryTagId, spendByTag } from "@lofit/domain";
import type { Tag, TagSpend, Transaction } from "@lofit/domain";
import { useState } from "react";
import { useRemoveTransaction } from "../useRemoveTransaction";
import { CATEGORY_COLORS, OTHER_COLOR, UNTAGGED_COLOR } from "../helpers/palette";
import { Donut } from "./donut";
import type { Slice } from "./donut";
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

const UNTAGGED_KEY = "untagged";

const OTHER_KEY = "other";

const SHOWN_TAGS = 5;

type SpendSlices = {
    slices: Slice[];
    tagsOf: Map<string, ReadonlySet<string>>;
};

function keyOf(row: TagSpend): string {
    return row.tagId ?? UNTAGGED_KEY;
}

function spendSlices(rows: readonly TagSpend[], tags: readonly Tag[]): SpendSlices {
    const ranked = rows.filter((row) => row.spent > 0).sort((a, b) => b.spent - a.spent);
    const fits = ranked.length <= SHOWN_TAGS + 1;
    const shown = fits ? ranked : ranked.slice(0, SHOWN_TAGS);
    const tail = fits ? [] : ranked.slice(SHOWN_TAGS);

    const position = new Map(tags.map((tag) => [tag.id, tag.position]));
    const colors = new Map(
        shown
            .filter((row) => row.tagId !== undefined)
            .sort((a, b) => (position.get(a.tagId!) ?? 0) - (position.get(b.tagId!) ?? 0))
            .map((row, index) => [keyOf(row), CATEGORY_COLORS[index % CATEGORY_COLORS.length]!]),
    );

    const slices: Slice[] = shown.map((row) => ({
        key: keyOf(row),
        label: row.label,
        value: row.spent,
        color: colors.get(keyOf(row)) ?? UNTAGGED_COLOR,
    }));
    const tagsOf = new Map<string, ReadonlySet<string>>(
        shown.map((row) => [keyOf(row), new Set([keyOf(row)])]),
    );

    if (tail.length > 0) {
        slices.push({
            key: OTHER_KEY,
            label: `Other (${tail.length})`,
            value: cents(tail.reduce((sum, row) => sum + row.spent, 0)),
            color: OTHER_COLOR,
        });
        tagsOf.set(OTHER_KEY, new Set(tail.map(keyOf)));
    }

    return { slices, tagsOf };
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
