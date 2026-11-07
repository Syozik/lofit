import { paidFor, toBase } from "@lofit/domain";
import type { AssetType, Cents, QuoteRef } from "@lofit/domain";
import { and, eq, getTableColumns, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { accounts, holdings } from "./db/schema";
import type { Tx } from "./ledger";
import { perBaseOn } from "./prices/history";
import { perBase } from "./prices/rates";

export type Buy = {
    symbol: string;
    name: string;
    type: AssetType;
    accountId: string;
    fromAccountId: string | null;
    quantity: number;
    price: Cents;
    currency: string;
    heldSince?: string | undefined;
    pricedAt?: string | undefined;
    quote?: QuoteRef | undefined;
};

export type PricedBuy = Buy & { heldIn: string; basePrice: Cents; cost: Cents; paid: Cents };

async function rate(currency: string, base: string, day: string | undefined): Promise<number> {
    const found = day ? await perBaseOn(currency, base, day) : await perBase(currency, base);
    if (!found) throw new HTTPException(422, { message: `No ${base} rate for ${currency}` });
    return found;
}

export async function priced(buy: Buy, owned: Map<string, string>, day?: string): Promise<PricedBuy> {
    const heldIn = owned.get(buy.accountId);
    const paidIn = buy.fromAccountId === null ? heldIn : owned.get(buy.fromAccountId);
    if (!heldIn || !paidIn) throw new HTTPException(422, { message: "Unknown account" });

    const basePrice = toBase(buy.price, await rate(buy.currency, heldIn, day));
    const cost = paidFor(buy.quantity, basePrice);
    const paid = paidIn === heldIn ? cost : toBase(cost, await rate(heldIn, paidIn, day));

    return { ...buy, heldIn, basePrice, cost, paid };
}

export async function settle(tx: Tx, userId: string, buy: PricedBuy, keepPrice = false) {
    const [upserted] = await tx
        .insert(holdings)
        .values({
            userId,
            symbol: buy.symbol,
            name: buy.name,
            type: buy.type,
            accountId: buy.accountId,
            quantity: buy.quantity,
            price: buy.basePrice,
            nativePrice: buy.price,
            currency: buy.currency,
            cost: buy.cost,
            costCurrency: buy.heldIn,
            ...(buy.heldSince ? { heldSince: buy.heldSince } : {}),
            pricedAt: buy.pricedAt ? new Date(buy.pricedAt) : null,
            quote: buy.quote ?? null,
        })
        .onConflictDoUpdate({
            target: [holdings.userId, holdings.symbol, holdings.accountId],
            set: {
                quantity: sql`${holdings.quantity} + excluded.quantity`,
                cost: sql`${holdings.cost} + excluded.cost`,
                heldSince: sql`least(${holdings.heldSince}, excluded.held_since)`,
                ...(keepPrice
                    ? {}
                    : {
                          price: sql`excluded.price`,
                          nativePrice: sql`excluded.native_price`,
                          currency: sql`excluded.currency`,
                          quote: sql`coalesce(excluded.quote, ${holdings.quote})`,
                          pricedAt: sql`excluded.priced_at`,
                      }),
            },
        })
        .returning({ ...getTableColumns(holdings), created: sql<boolean>`xmax = 0` });

    if (!upserted) throw new Error("Upserting a holding returned no row.");

    if (buy.fromAccountId === null) return upserted;

    await tx
        .update(accounts)
        .set({ balance: sql`${accounts.balance} - ${buy.paid}` })
        .where(and(eq(accounts.id, buy.fromAccountId), eq(accounts.userId, userId)));

    return upserted;
}
