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

export const EURO = "EUR";

export const CURRENCIES = [EURO, "USD", "GBP", "CHF", "PLN", "CZK", "SEK", "NOK", "DKK"] as const;

export type Currency = (typeof CURRENCIES)[number];

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
    EUR: "€",
    USD: "$",
    GBP: "£",
    CHF: "CHF",
    PLN: "zł",
    CZK: "Kč",
    SEK: "kr",
    NOK: "kr",
    DKK: "kr",
};

export const CURRENCY_NAMES: Record<Currency, string> = {
    EUR: "Euro",
    USD: "US dollar",
    GBP: "British pound",
    CHF: "Swiss franc",
    PLN: "Polish złoty",
    CZK: "Czech koruna",
    SEK: "Swedish krona",
    NOK: "Norwegian krone",
    DKK: "Danish krone",
};

export interface Settings {
    currency: Currency;
}

export function isCurrency(value: unknown): value is Currency {
    return typeof value === "string" && (CURRENCIES as readonly string[]).includes(value);
}

let displayed: Currency = EURO;

export function setDisplayCurrency(currency: Currency): void {
    displayed = currency;
}

export function displayCurrency(): Currency {
    return displayed;
}

export function priceCurrencies(): Currency[] {
    return [...new Set<Currency>([displayed, EURO, "USD"])];
}

export function currencySymbol(currency: Currency = displayed): string {
    return CURRENCY_SYMBOLS[currency];
}

export function currencyLabel(currency: Currency): string {
    const symbol = CURRENCY_SYMBOLS[currency];
    return symbol === currency ? currency : `${symbol} ${currency}`;
}

export function withSymbol(amount: string, currency: Currency = displayed): string {
    const symbol = CURRENCY_SYMBOLS[currency];
    return /\p{L}$/u.test(symbol) ? `${symbol} ${amount}` : `${symbol}${amount}`;
}

export function formatMoney(value: Cents): string {
    return `${value < 0 ? "−" : ""}${withSymbol(formatAmount(value))}`;
}

export function toBase(amount: Cents, perBase: number): Cents {
    if (perBase <= 0) throw new RangeError(`A rate must be positive, got ${perBase}`);
    return cents(Math.round(amount / perBase));
}
