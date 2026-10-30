import type { Cents, Currency } from "./money";
import type { TransactionKind } from "./types";

export const CADENCES = ["weekly", "monthly", "yearly"] as const;
export type Cadence = (typeof CADENCES)[number];

export const CADENCE_LABELS: Record<Cadence, string> = {
    weekly: "Weekly",
    monthly: "Monthly",
    yearly: "Yearly",
};

export interface Recurring {
    id: string;
    name: string;
    kind: TransactionKind;
    tagIds: readonly string[];
    accountId: string;
    toAccountId?: string;
    amount: Cents;
    toAmount?: Cents;
    currency: Currency;
    cadence: Cadence;
    anchor: string;
    nextDue: string;
    paused: boolean;
    shown: Cents;
}

export type NewRecurring = Omit<Recurring, "id" | "nextDue" | "paused" | "shown"> & { id?: string };

export type RecurringPatch = Partial<Pick<Recurring, "name" | "amount" | "cadence" | "nextDue" | "paused">>;

function parts(day: string): [number, number, number] {
    const [year, month, date] = day.split("-").map(Number);
    return [year!, month!, date!];
}

function format(year: number, month: number, date: number): string {
    return `${year}-${String(month).padStart(2, "0")}-${String(date).padStart(2, "0")}`;
}

function daysIn(year: number, month: number): number {
    return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function following(day: string, cadence: Cadence, anchor: string = day): string {
    const [year, month, date] = parts(day);
    const [, anchorMonth, anchorDate] = parts(anchor);

    if (cadence === "weekly") {
        return new Date(Date.UTC(year, month - 1, date + 7)).toISOString().slice(0, 10);
    }
    if (cadence === "monthly") {
        const nextYear = month === 12 ? year + 1 : year;
        const nextMonth = month === 12 ? 1 : month + 1;
        return format(nextYear, nextMonth, Math.min(anchorDate, daysIn(nextYear, nextMonth)));
    }
    return format(year + 1, anchorMonth, Math.min(anchorDate, daysIn(year + 1, anchorMonth)));
}

export function dueDays(recurring: Pick<Recurring, "nextDue" | "cadence" | "anchor">, through: string): string[] {
    const days: string[] = [];
    for (let day = recurring.nextDue; day <= through; day = following(day, recurring.cadence, recurring.anchor)) {
        days.push(day);
    }
    return days;
}

export type Upcoming = { recurring: Recurring; day: string };

export function upcomingIn(all: readonly Recurring[], period: string, after: string): Upcoming[] {
    const [year, month] = period.split("-").map(Number);
    const last = format(year!, month!, daysIn(year!, month!));
    return all
        .filter((recurring) => !recurring.paused)
        .flatMap((recurring) =>
            dueDays(recurring, last)
                .filter((day) => day > after && day.startsWith(period))
                .map((day) => ({ recurring, day })),
        )
        .sort((one, other) => (one.day < other.day ? -1 : one.day > other.day ? 1 : 0));
}

export function cadenceLabel(recurring: Pick<Recurring, "cadence" | "anchor">): string {
    const [, month, date] = parts(recurring.anchor);
    if (recurring.cadence === "weekly") {
        const weekday = new Date(`${recurring.anchor}T00:00:00Z`).toLocaleDateString("en-GB", {
            weekday: "long",
            timeZone: "UTC",
        });
        return `Every ${weekday}`;
    }
    if (recurring.cadence === "monthly") return `Monthly on the ${ordinal(date)}`;
    const name = new Date(Date.UTC(2000, month - 1, 1)).toLocaleDateString("en-GB", { month: "long", timeZone: "UTC" });
    return `Yearly on ${date} ${name}`;
}

function ordinal(value: number): string {
    const tens = value % 100;
    if (tens >= 11 && tens <= 13) return `${value}th`;
    return `${value}${["th", "st", "nd", "rd"][value % 10] ?? "th"}`;
}
