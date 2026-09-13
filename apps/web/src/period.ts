import { createContext, useContext } from "react";

export const PeriodContext = createContext<(period: string) => void>(() => {});

export function useSetPeriod() {
    return useContext(PeriodContext);
}

export function currentPeriod(): string {
    return new Date().toISOString().slice(0, 7);
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
