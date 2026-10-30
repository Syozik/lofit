import { CURRENCIES, currencyLabel } from "@lofit/domain";
import type { Currency } from "@lofit/domain";
import { Select } from "./Select";

export const CURRENCY_OPTIONS = CURRENCIES.map((currency) => ({ value: currency, label: currencyLabel(currency) }));

type Props = {
    value: Currency;
    onChange: (currency: Currency) => void;
    hint?: string | undefined;
};

export function CurrencyPicker({ value, onChange, hint }: Props) {
    return <Select label="Currency" value={value} options={CURRENCY_OPTIONS} onChange={onChange} hint={hint} />;
}
