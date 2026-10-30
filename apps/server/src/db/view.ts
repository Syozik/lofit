import { EURO } from "@lofit/domain";
import { eq, isNotNull, and } from "drizzle-orm";
import { loadFx } from "../prices/fx";
import { db } from "./client";
import type { View } from "./mappers";
import { accounts, budgets, holdings } from "./schema";

export async function viewFor(userId: string, currency: string, since?: string): Promise<View> {
    const [held, limits, owned] = await Promise.all([
        db
            .selectDistinct({ quote: holdings.currency, cost: holdings.costCurrency })
            .from(holdings)
            .where(eq(holdings.userId, userId)),
        db.selectDistinct({ currency: budgets.currency }).from(budgets).where(eq(budgets.userId, userId)),
        db
            .selectDistinct({ currency: accounts.currency })
            .from(accounts)
            .where(and(eq(accounts.userId, userId), isNotNull(accounts.currency))),
    ]);

    const currencies = [
        currency,
        EURO,
        ...owned.map((row) => row.currency),
        ...limits.map((row) => row.currency),
        ...held.flatMap((row) => (row.quote ? [row.quote, row.cost] : [row.cost])),
    ];

    return { fx: await loadFx(currencies, since), currency };
}
