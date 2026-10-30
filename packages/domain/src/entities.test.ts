import { describe, expect, it } from "vitest";
import { addUnits, balanceChanges, euros, holdingValue, isInstant, withBalance } from "./index";
import type { Account, Holding } from "./index";

const asml: Holding = {
    id: "asml",
    symbol: "ASML",
    name: "ASML Holding",
    type: "stock",
    accountId: "degiro",
    quantity: 12,
    cost: euros(6480),
    heldSince: "2025-01-20",
    nativePrice: euros(767.04),
    currency: "EUR",
    price: euros(767.04),
    pricedAt: "2026-08-07T17:30:00Z",
};

describe("holdings", () => {
    it("are worth quantity times price, rounded to the cent", () => {
        expect(holdingValue(asml)).toBe(920448);
        expect(holdingValue({ quantity: 0.0425, price: euros(58420) })).toBe(248285);
    });

    it("top up by adding units at the newer price, and what they cost", () => {
        expect(addUnits(asml, 3, euros(800), "2026-08-08T09:00:00Z")).toStrictEqual({
            ...asml,
            quantity: 15,
            price: 80000,
            cost: 888000,
            pricedAt: "2026-08-08T09:00:00Z",
        });
    });

    it("drop the old timestamp when the new price has none, leaving the original alone", () => {
        expect(addUnits(asml, 3, euros(800))).toStrictEqual({
            id: "asml",
            symbol: "ASML",
            name: "ASML Holding",
            type: "stock",
            accountId: "degiro",
            quantity: 15,
            price: 80000,
            nativePrice: 76704,
            currency: "EUR",
            cost: 888000,
            heldSince: "2025-01-20",
        });
        expect(asml.quantity).toBe(12);
    });
});

describe("accounts", () => {
    it("change balance by copy, leaving the original untouched", () => {
        const ing: Account = { id: "ing", name: "ING", subtitle: "", groupId: "g-cash", balance: euros(3240.18), currency: "EUR", nativeBalance: euros(3240.18), provenance: "synced" };

        expect(withBalance(ing, euros(3000))).toStrictEqual({ ...ing, balance: 300000 });
        expect(ing.balance).toBe(324018);
    });
});

describe("balance changes", () => {
    it("move only the account an expense is booked on", () => {
        expect(balanceChanges({ accountId: "ing", amount: euros(-42.18) })).toStrictEqual([
            { accountId: "ing", delta: -4218 },
        ]);
    });

    it("move a transfer's destination the opposite way", () => {
        expect(balanceChanges({ accountId: "ing", toAccountId: "loan", amount: euros(-145) })).toStrictEqual([
            { accountId: "ing", delta: -14500 },
            { accountId: "loan", delta: 14500 },
        ]);
    });
});

describe("isInstant", () => {
    it.each(["2026-07-29T17:42:00Z", "2026-07-29T17:42:00.000Z"])("accepts %s", (value) => {
        expect(isInstant(value)).toBe(true);
    });

    it.each(["2026-07-29", "2026-07-29T19:42:00+02:00", "2026-07-29 17:42:00Z", "2026-07-29T17:42Z"])(
        "rejects %s",
        (value) => {
            expect(isInstant(value)).toBe(false);
        },
    );
});
