import { useBudgets, useSetBudget, useTags, useTransactions } from "@lofit/api";
import { cents, euros, formatAmount, spendByTag, sumCents, tagsFor } from "@lofit/domain";
import type { Cents } from "@lofit/domain";
import { parsePositive } from "@lofit/view";
import { useState } from "react";
import { Sheet } from "./sheet";

function limitOf(input: string): Cents | null | undefined {
    if (!input.trim()) return null;
    const value = parsePositive(input);
    return value === undefined ? undefined : euros(value);
}

type Props = {
    period: string;
    onClose: () => void;
    onSaved: (message: string) => void;
};

export function BudgetSheet({ period, onClose, onSaved }: Props) {
    const { data: allTags = [] } = useTags();
    const tags = tagsFor(allTags, "expense");
    const { data: budgets = [] } = useBudgets();
    const { data: transactions = [] } = useTransactions();
    const setBudget = useSetBudget();

    const current = new Map(budgets.map((budget) => [budget.tagId, budget.limit]));
    const [drafts, setDrafts] = useState<Record<string, string>>(() =>
        Object.fromEntries(
            budgets.map((budget) => [budget.tagId, (budget.limit / 100).toFixed(2)]),
        ),
    );

    const spent = new Map(
        spendByTag(transactions, budgets, tags, period).tags.map((row) => [row.tagId, row.spent]),
    );
    const ordered = [...tags].sort((one, other) => one.position - other.position);
    const limits = ordered.map((tag) => ({ tagId: tag.id, limit: limitOf(drafts[tag.id] ?? "") }));
    const invalid = limits.some((entry) => entry.limit === undefined);
    const total = sumCents(limits.flatMap((entry) => (entry.limit ? [entry.limit] : [])));

    function save() {
        if (invalid) return;
        for (const { tagId, limit } of limits) {
            if (limit === undefined || limit === (current.get(tagId) ?? null)) continue;
            setBudget.mutate({ tagId, limit });
        }
        onSaved("Budgets saved");
        onClose();
    }

    return (
        <Sheet label="Budgets" onClose={onClose}>
            <div className="sheet-head">
                <h4 className="sheet-title">Budgets</h4>
                <span className="sheet-note">Monthly · per tag</span>
            </div>

            <div className="budget-rows">
                {ordered.map((tag) => {
                    const bad = limitOf(drafts[tag.id] ?? "") === undefined;
                    return (
                        <label key={tag.id} className="budget-row">
                            <span className="budget-row-label">
                                <span className="budget-row-name">{tag.name}</span>
                                <span className="budget-row-spent">
                                    € {formatAmount(spent.get(tag.id) ?? cents(0))} spent
                                </span>
                            </span>
                            <span className={`budget-input input ${bad ? "invalid" : ""}`}>
                                <span className="budget-input-currency">€</span>
                                <input
                                    autoComplete="off"
                                    inputMode="decimal"
                                    placeholder="No budget"
                                    aria-label={`${tag.name} budget`}
                                    aria-invalid={bad}
                                    value={drafts[tag.id] ?? ""}
                                    onChange={(event) =>
                                        setDrafts((typed) => ({
                                            ...typed,
                                            [tag.id]: event.target.value,
                                        }))
                                    }
                                />
                            </span>
                        </label>
                    );
                })}
            </div>

            <div className="sheet-actions budget-actions">
                <span className="budget-total">€ {formatAmount(total)} a month</span>
                <button className="btn btn-secondary" onClick={onClose}>
                    Cancel
                </button>
                <button className="btn btn-primary sheet-save" disabled={invalid} onClick={save}>
                    Save
                </button>
            </div>
        </Sheet>
    );
}
