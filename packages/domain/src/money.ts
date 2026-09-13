export type Cents = number & { readonly __brand: "Cents" };

export function cents(value: number): Cents {
    if (!Number.isInteger(value)) {
        throw new TypeError(`Cents must be a whole number, got ${value}`);
    }
    return value as Cents;
}

export function euros(value: number): Cents {
    return cents(Math.round(value * 100));
}

export function addCents(a: Cents, b: Cents): Cents {
    return cents(a + b);
}

export function sumCents(values: readonly Cents[]): Cents {
    return cents(values.reduce<number>((total, value) => total + value, 0));
}

export function negateCents(value: Cents): Cents {
    return cents(-value);
}

export function absCents(value: Cents): Cents {
    return cents(Math.abs(value));
}

const amountFormat = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

export function formatAmount(value: Cents): string {
    return amountFormat.format(Math.abs(value) / 100);
}

export function formatEuros(value: Cents): string {
    return `${value < 0 ? "− € " : "€ "}${formatAmount(value)}`;
}

export const EURO = "EUR";

export const CURRENCIES = [EURO, "USD"] as const;

export type Currency = (typeof CURRENCIES)[number];

export function toEuros(amount: Cents, perEuro: number): Cents {
    if (perEuro <= 0) throw new RangeError(`A rate must be positive, got ${perEuro}`);
    return cents(Math.round(amount / perEuro));
}
