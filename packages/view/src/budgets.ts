import { cents, formatAmount, periodOf, withSymbol } from "@lofit/domain";
import type { Cents } from "@lofit/domain";

export type BudgetState = "ok" | "ahead" | "over";

export interface BudgetStatus {
    state: BudgetState;
    pct: number;
    pace?: number;
    note: string;
}

const SLACK = 0.1;

function money(value: number): string {
    return withSymbol(formatAmount(cents(Math.round(value))));
}

export function budgetStatus(spent: Cents, limit: Cents, period: string, upcoming = 0, now = new Date()): BudgetStatus {
    const pct = limit > 0 ? Math.min(100, Math.round((spent / limit) * 100)) : 0;
    const left = limit - spent;

    if (left < 0) return { state: "over", pct, note: `${money(-left)} over` };

    if (period !== periodOf(now.toISOString())) return { state: "ok", pct, note: `${money(left)} left` };

    const days = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
    const day = now.getUTCDate();
    const pace = day / days;
    const free = left - upcoming;
    const ahead = free < 0 || spent > limit * Math.min(1, pace + SLACK);
    const perDay = Math.max(0, free) / (days - day + 1);

    return {
        state: ahead ? "ahead" : "ok",
        pct,
        pace,
        note: upcoming > 0 ? `${money(left)} left · ${money(upcoming)} due · ${money(perDay)}/day` : `${money(left)} left · ${money(perDay)}/day`,
    };
}
