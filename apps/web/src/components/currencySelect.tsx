import { CURRENCIES, currencyLabel } from "@lofit/domain";
import type { Currency } from "@lofit/domain";

type Props = {
    value: Currency;
    onChange: (currency: Currency) => void;
    disabled?: boolean;
};

export function CurrencySelect({ value, onChange, disabled = false }: Props) {
    return (
        <select
            className="input"
            value={value}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value as Currency)}
        >
            {CURRENCIES.map((currency) => (
                <option key={currency} value={currency}>
                    {currencyLabel(currency)}
                </option>
            ))}
        </select>
    );
}
