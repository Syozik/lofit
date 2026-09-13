import { addCents, cents } from "./money";
import type { Cents, Currency } from "./money";
import type { QuoteRef } from "./quote";
import type { Delta } from "./snapshot";
import type { AssetType } from "./types";

export interface Holding {
    id: string;
    symbol: string;
    name: string;
    type: AssetType;
    accountId: string;
    quantity: number;
    price: Cents;
    nativePrice: Cents;
    currency: Currency;
    cost: Cents;
    heldSince: string;
    pricedAt?: string;
    quote?: QuoteRef;
}

export type NewHolding = Omit<Holding, "id" | "cost" | "heldSince" | "nativePrice"> & {
    heldSince?: string;
};

export function holdingValue(holding: Pick<Holding, "quantity" | "price">): Cents {
    return cents(Math.round(holding.quantity * holding.price));
}

export function paidFor(quantity: number, price: Cents): Cents {
    return cents(Math.round(quantity * price));
}

export function holdingGain(holding: Pick<Holding, "quantity" | "price" | "cost">): Delta {
    const amount = cents(holdingValue(holding) - holding.cost);

    return {
        amount,
        pct: holding.cost === 0 ? 0 : Math.round((amount / Math.abs(holding.cost)) * 10000) / 100,
        favourable: amount >= 0,
    };
}

export function addUnits(
    holding: Holding,
    quantity: number,
    price: Cents,
    pricedAt?: string,
): Holding {
    const topped: Holding = {
        id: holding.id,
        symbol: holding.symbol,
        name: holding.name,
        type: holding.type,
        accountId: holding.accountId,
        quantity: holding.quantity + quantity,
        price,
        nativePrice: holding.nativePrice,
        currency: holding.currency,
        cost: addCents(holding.cost, paidFor(quantity, price)),
        heldSince: holding.heldSince,
    };

    if (pricedAt) topped.pricedAt = pricedAt;
    if (holding.quote) topped.quote = holding.quote;

    return topped;
}

export interface Sale {
    sold: number;
    proceeds: Cents;
    costSold: Cents;
    left?: Holding;
}

export function sellUnits(holding: Holding, quantity: number, price: Cents): Sale {
    const sold = Math.min(quantity, holding.quantity);
    const proceeds = paidFor(sold, price);
    const costSold = cents(Math.round((holding.cost * sold) / holding.quantity));

    if (sold >= holding.quantity) return { sold, proceeds, costSold };

    const left: Holding = {
        ...holding,
        quantity: holding.quantity - sold,
        cost: cents(holding.cost - costSold),
    };

    return { sold, proceeds, costSold, left };
}
