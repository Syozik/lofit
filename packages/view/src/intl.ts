const formats = new Map<string, Intl.NumberFormat>();

export function numberFormat(locale: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
    const key = `${locale}|${JSON.stringify(options)}`;
    let format = formats.get(key);
    if (!format) {
        format = new Intl.NumberFormat(locale, options);
        formats.set(key, format);
    }
    return format;
}

export function currencyFormat(currency: string): Intl.NumberFormat {
    return numberFormat("en-IE", { style: "currency", currency });
}

const whole = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export function wholeNumber(value: number): string {
    return whole.format(value);
}
