import { euros } from "@lofit/domain";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "../src/db/client";
import { holdings } from "../src/db/schema";
import { postRaw, signedIn } from "./client";
import { createAccount, createHolding, createUser } from "./factories";

const holdingsOf = (userId: string) => db.select().from(holdings).where(eq(holdings.userId, userId));

describe("GET /api/holdings", () => {
    it("lists the user's positions, largest value first", async () => {
        const me = await createUser();
        const mine = signedIn(me);
        const someoneElse = await createUser("someone@lofit.test");
        const kraken = await createAccount(me.id, { name: "Kraken" });
        await createHolding(me.id, { symbol: "BTC", type: "crypto", accountId: kraken.id, quantity: 0.0425, price: euros(58420) });
        await createHolding(me.id, { symbol: "VWRL", quantity: 224, price: euros(117.9) });
        await createHolding(me.id, { symbol: "ASML", type: "stock", quantity: 12, price: euros(767.04) });
        await createHolding(someoneElse.id, { symbol: "MSFT", type: "stock", quantity: 1000, price: euros(451.15) });

        const response = await mine.holdings.$get();
        const positions = await response.json();

        expect(positions.map((holding) => [holding.symbol, holding.quantity])).toEqual([
            ["VWRL", 224],
            ["ASML", 12],
            ["BTC", 0.0425],
        ]);
    });
});

describe("POST /api/holdings", () => {
    const asml = (accountId: string) =>
        ({
            symbol: "ASML",
            name: "ASML Holding",
            type: "stock",
            accountId,
            quantity: 3,
            price: 80000,
        }) as const;

    it("opens a new position with a trimmed, uppercase symbol, and records what it cost", async () => {
        const me = await createUser();
        const mine = signedIn(me);
        const degiro = await createAccount(me.id, { name: "DEGIRO" });

        const response = await mine.holdings.$post({
            json: {
                symbol: " vwrl ",
                name: "Vanguard FTSE All-World",
                type: "etf",
                accountId: degiro.id,
                quantity: 10,
                price: 11790,
                pricedAt: "2026-08-07T17:30:00Z",
            },
        });

        expect(response.status).toBe(201);
        expect(await response.json()).toStrictEqual({
            id: expect.any(String),
            symbol: "VWRL",
            name: "Vanguard FTSE All-World",
            type: "etf",
            accountId: degiro.id,
            quantity: 10,
            price: 11790,
            nativePrice: 11790,
            currency: "EUR",
            cost: 117900,
            heldSince: expect.any(String),
            pricedAt: "2026-08-07T17:30:00.000Z",
        });
    });

    it("tops up a position you already hold: units add up and the new price replaces the old", async () => {
        const me = await createUser();
        const mine = signedIn(me);
        const degiro = await createAccount(me.id, { name: "DEGIRO" });
        const held = await createHolding(me.id, {
            symbol: "ASML",
            name: "ASML Holding",
            type: "stock",
            accountId: degiro.id,
            quantity: 12,
            price: euros(767.04),
            cost: euros(6480),
            pricedAt: new Date("2026-08-07T17:30:00Z"),
        });

        const response = await mine.holdings.$post({ json: asml(degiro.id) });

        expect(response.status).toBe(200);
        expect(await response.json()).toStrictEqual({
            id: held.id,
            symbol: "ASML",
            name: "ASML Holding",
            type: "stock",
            accountId: degiro.id,
            quantity: 15,
            price: 80000,
            nativePrice: 80000,
            currency: "EUR",
            cost: 888000,
            heldSince: expect.any(String),
        });
        expect(await holdingsOf(me.id)).toHaveLength(1);
    });

    it("keeps the same instrument at two brokers apart", async () => {
        const me = await createUser();
        const mine = signedIn(me);
        const degiro = await createAccount(me.id, { name: "DEGIRO" });
        const other = await createAccount(me.id, { name: "Trading 212" });
        await createHolding(me.id, { symbol: "ASML", name: "ASML Holding", type: "stock", accountId: other.id, quantity: 1 });

        const response = await mine.holdings.$post({ json: asml(degiro.id) });

        expect(response.status).toBe(201);
        expect(await holdingsOf(me.id)).toHaveLength(2);
    });

    it("never tops up another user's position", async () => {
        const me = await createUser();
        const mine = signedIn(me);
        const someoneElse = await createUser("someone@lofit.test");
        const degiro = await createAccount(me.id, { name: "DEGIRO" });
        await createHolding(someoneElse.id, { symbol: "ASML", name: "ASML Holding", type: "stock", quantity: 12 });

        const response = await mine.holdings.$post({ json: asml(degiro.id) });

        expect(response.status).toBe(201);
        expect((await holdingsOf(me.id)).map((holding) => holding.quantity)).toEqual([3]);
        expect((await holdingsOf(someoneElse.id)).map((holding) => holding.quantity)).toEqual([12]);
    });

    it("rejects invalid input, names every failing field and stores nothing", async () => {
        const me = await createUser();

        const response = await postRaw(
            "/api/holdings",
            JSON.stringify({
                symbol: "",
                name: "Nothing",
                type: "bond",
                accountId: (await createAccount(me.id)).id,
                quantity: 0,
                price: 0,
            }),
            me.cookie,
        );
        const body = (await response.json()) as { error: string; issues: { path: string }[] };

        expect(response.status).toBe(400);
        expect(body.error).toBe("Invalid request");
        expect(body.issues.map((issue) => issue.path)).toEqual(["symbol", "type", "quantity", "price"]);
        expect(await holdingsOf(me.id)).toHaveLength(0);
    });
});
