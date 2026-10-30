import { currencyFormat, wholeNumber } from "./intl";
import { amountFor } from "./transaction";
import { byRecency, displayCurrency, holdingGain, periodOf, withSymbol } from "@lofit/domain";
import type { Account, AccountChange, Currency, Holding, Transaction } from "@lofit/domain";

const timeFormat = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
});

const dateTimeFormat = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
});

export const dayFormat = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
});

function sameDay(one: Date, other: Date): boolean {
    return one.toDateString() === other.toDateString();
}

export function formatSync(instant: string): string {
    const when = new Date(instant);
    return sameDay(when, new Date())
        ? `today ${timeFormat.format(when)}`
        : dateTimeFormat.format(when).replace(",", "");
}

export function accountChangeLabel(change: AccountChange, currency?: Currency): string {
    const rounded = wholeNumber(Math.round(Math.abs(change.amount) / 100));
    return `${change.amount < 0 ? "−" : "+"}${withSymbol(rounded, currency)} ${change.period}`;
}

export function inOwnCurrency(account: Account): boolean {
    return account.currency !== displayCurrency();
}

export function detailLines(account: Account): readonly { label: string; value: string }[] {
    const lines = [...(account.details ?? [])];
    if (account.lastSyncedAt)
        lines.push({ label: "Last sync", value: formatSync(account.lastSyncedAt) });
    if (account.statedAt) lines.push({ label: "You updated", value: formatSync(account.statedAt) });
    return lines;
}

const shareFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 });
const unitFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 8 });

export function inCurrency(holding: Pick<Holding, "currency">, amount: number): string {
    return currencyFormat(holding.currency).format(amount / 100);
}

export function formatUnits(holding: Holding): string {
    const format = holding.type === "crypto" ? unitFormat : shareFormat;
    return `${format.format(holding.quantity)} × ${inCurrency(holding, holding.nativePrice)}`;
}

export function signedWholeMoney(amount: number): string {
    return `${amount < 0 ? "−" : "+"}${withSymbol(wholeNumber(Math.round(Math.abs(amount) / 100)))}`;
}

export function gainLabel(holding: Holding): { text: string; favourable: boolean } {
    const gain = holdingGain(holding);
    const sign = gain.amount < 0 ? "−" : "+";
    return {
        text: `${signedWholeMoney(gain.amount)} · ${sign}${Math.abs(gain.pct).toFixed(1)}%`,
        favourable: gain.favourable,
    };
}

export function latestPricing(holdings: readonly Holding[]): string | undefined {
    return holdings
        .map((holding) => holding.pricedAt)
        .filter((stamp): stamp is string => stamp !== undefined)
        .sort()
        .at(-1);
}

export type HistoryMonth = {
    period: string;
    net: number;
    entries: Transaction[];
};

export function historyByMonth(
    transactions: readonly Transaction[],
    accountId: string,
): HistoryMonth[] {
    const months: HistoryMonth[] = [];
    for (const transaction of byRecency(transactions)) {
        const period = periodOf(transaction.occurredAt);
        let month = months[months.length - 1];
        if (!month || month.period !== period) {
            month = { period, net: 0, entries: [] };
            months.push(month);
        }
        month.entries.push(transaction);
        month.net += amountFor(transaction, accountId);
    }
    return months;
}

export function parseAmount(input: string): number | undefined {
    const typed = input.replace(",", ".").replace(/[−–—]/g, "-");
    const value = Number.parseFloat(typed);
    return Number.isFinite(value) ? value : undefined;
}

export function parsePositive(input: string): number | undefined {
    const value = Number.parseFloat(input.replace(",", "."));
    return Number.isFinite(value) && value > 0 ? value : undefined;
}
