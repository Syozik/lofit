import { sumCents, type Account, type Cents } from "@lofit/domain";

export function getTotal(accounts: Account[]): Cents {
    return sumCents(accounts.map((account) => account.balance));
}
