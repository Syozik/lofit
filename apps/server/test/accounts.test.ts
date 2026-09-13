import { euros } from "@lofit/domain";
import { describe, expect, it } from "vitest";
import { signedIn } from "./client";
import { createAccount, createGroup, createUser } from "./factories";

describe("GET /api/accounts", () => {
    it("returns only the user's accounts, by group and then in the order they were added", async () => {
        const me = await createUser();
        const mine = signedIn(me);
        const someoneElse = await createUser("someone@lofit.test");
        const debt = await createGroup(me.id, "Debt", 2);
        await createAccount(me.id, { name: "Studieschuld", groupId: debt.id, balance: euros(-8750) });
        await createAccount(me.id, { name: "ING", balance: euros(3240.18) });
        await createAccount(me.id, { name: "Revolut", balance: euros(842.55) });
        await createAccount(someoneElse.id, { name: "Not mine" });

        const response = await mine.accounts.$get();
        const accounts = await response.json();

        expect(response.status).toBe(200);
        expect(accounts.map((account) => [account.name, account.balance])).toEqual([
            ["ING", 324018],
            ["Revolut", 84255],
            ["Studieschuld", -875000],
        ]);
    });

    it("sends timestamps as UTC ISO strings and leaves empty optional fields out", async () => {
        const me = await createUser();
        const mine = signedIn(me);
        await createAccount(me.id, {
            name: "ING",
            provenance: "synced",
            lastSyncedAt: new Date("2026-08-01T08:12:00Z"),
            change: { amount: euros(-212), period: "this month", favourable: false },
        });
        await createAccount(me.id, { name: "DUO" });

        const response = await mine.accounts.$get();

        expect(await response.json()).toStrictEqual([
            {
                id: expect.any(String),
                name: "ING",
                subtitle: "",
                groupId: expect.any(String),
                balance: 0,
                provenance: "synced",
                lastSyncedAt: "2026-08-01T08:12:00.000Z",
                change: { amount: -21200, period: "this month", favourable: false },
            },
            {
                id: expect.any(String),
                name: "DUO",
                subtitle: "",
                groupId: expect.any(String),
                balance: 0,
                provenance: "manual",
            },
        ]);
    });
});
