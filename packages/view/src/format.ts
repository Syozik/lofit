import { formatAmount } from "@lofit/domain";
import type { Cents } from "@lofit/domain";
import { wholeNumber } from "./intl";

export function shortEuros(value: Cents): string {
    return `€ ${wholeNumber(Math.round(Math.abs(value) / 100))}`;
}

export function signedAmount(value: Cents): string {
    return `${value < 0 ? "−" : "+"} € ${formatAmount(value)}`;
}

export function signedPercent(value: number): string {
    return `${value < 0 ? "−" : "+"}${Math.abs(value).toFixed(1)}%`;
}

const MONTH_NAMES = {
    short: new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }),
    long: new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "UTC" }),
};

export function monthName(period: string, length: "short" | "long"): string {
    return MONTH_NAMES[length].format(new Date(`${period}-01T00:00:00Z`));
}

export function yearOf(period: string): string {
    return period.slice(0, 4);
}
