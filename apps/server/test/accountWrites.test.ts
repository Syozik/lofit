import { euros } from "@lofit/domain";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "../src/db/client";
import { accounts } from "../src/db/schema";
import { postRaw, signedIn } from "./client";
import { createAccount, createGroup, createUser, firstGroup } from "./factories";

async function stored(id: string) {
    const [row] = await db.select().from(accounts).where(eq(accounts.id, id)).limit(1);
    return row;
}

describe("POST /api/accounts", () => {
    it("creates a manual account and states it as of now", async () => {
        const me = await createUser();
        const mine = signedIn(me);

        const cash = await firstGroup(me.id);

        const response = await mine.accounts.$post({
            json: { name: "  Revolut  ", subtitle: " savings ", groupId: cash.id, balance: euros(842.55) },
        });

        expect(response.status).toBe(201);
        if (!response.ok) throw new Error("account was not created");

        const account = await response.json();
        expect(account.name).toBe("Revolut");
        expect(account.subtitle).toBe("savings");
        expect(account.groupId).toBe(cash.id);
        expect(account.balance).toBe(84255);
        expect(account.provenance).toBe("manual");
        expect(account.statedAt).toEqual(expect.any(String));
    });

    it("holds a debt account as a negative balance", async () => {
        const me = await createUser();
        const mine = signedIn(me);

        const debt = await createGroup(me.id, "Debt", 2);

        const response = await mine.accounts.$post({
            json: { name: "Studieschuld", subtitle: "", groupId: debt.id, balance: euros(-8750) },
        });

        if (!response.ok) throw new Error("account was not created");
        expect((await response.json()).balance).toBe(-875000);
    });

    it("lets the subtitle be left out", async () => {
        const me = await createUser();
        const mine = signedIn(me);

        const response = await mine.accounts.$post({
            json: { name: "Spaarrekening", groupId: (await firstGroup(me.id)).id, balance: euros(0) },
        });

        if (!response.ok) throw new Error("account was not created");
        expect((await response.json()).subtitle).toBe("");
    });

    it("shows up in the list, owned by the signed-in user", async () => {
        const me = await createUser();
        const mine = signedIn(me);

        await mine.accounts.$post({
            json: { name: "ING", subtitle: "", groupId: (await firstGroup(me.id)).id, balance: euros(10) },
        });
        const listed = await (await mine.accounts.$get()).json();

        expect(listed.map((account) => account.name)).toEqual(["ING"]);
    });

    it("refuses a blank name", async () => {
        const me = await createUser();

        const response = await postRaw(
            "/api/accounts",
            JSON.stringify({ name: "   ", subtitle: "", groupId: (await firstGroup(me.id)).id, balance: 0 }),
            me.cookie,
        );

        expect(response.status).toBe(400);
    });

    it("takes an investment account stated as one number", async () => {
        const me = await createUser();
        const mine = signedIn(me);

        const investments = await createGroup(me.id, "Pension", 3);

        const response = await mine.accounts.$post({
            json: {
                name: "Pensioenfonds",
                subtitle: "employer plan",
                groupId: investments.id,
                balance: euros(42000),
            },
        });

        expect(response.status).toBe(201);
        if (!response.ok) throw new Error("account was not created");
        expect((await response.json()).groupId).toBe(investments.id);
    });

    it("refuses a balance that is not whole cents", async () => {
        const me = await createUser();

        const response = await postRaw(
            "/api/accounts",
            JSON.stringify({ name: "ING", subtitle: "", groupId: (await firstGroup(me.id)).id, balance: 12.5 }),
            me.cookie,
        );

        expect(response.status).toBe(400);
    });
});

describe("PATCH /api/accounts/:id", () => {
    it("re-states the balance and records the rise", async () => {
        const me = await createUser();
        const mine = signedIn(me);
        const account = await createAccount(me.id, {
            name: "ING",
            balance: euros(3200),
            statedAt: new Date("2026-10-02T08:00:00Z"),
        });

        const response = await mine.accounts[":id"].$patch({
            param: { id: account.id },
            json: { balance: euros(3430) },
        });

        expect(response.status).toBe(200);
        if (!response.ok) throw new Error("balance was not updated");

        const updated = await response.json();
        expect(updated.balance).toBe(343000);
        expect(updated.change).toStrictEqual({
            amount: 23000,
            period: "since 2 Oct",
            favourable: true,
        });
        expect(updated.statedAt).toEqual(expect.any(String));
    });

    it("counts owing less on a debt account as favourable", async () => {
        const me = await createUser();
        const mine = signedIn(me);
        const loan = await createAccount(me.id, {
            name: "Studieschuld",
            balance: euros(-8750),
            statedAt: new Date("2026-09-30T08:00:00Z"),
        });

        const response = await mine.accounts[":id"].$patch({
            param: { id: loan.id },
            json: { balance: euros(-8000) },
        });

        if (!response.ok) throw new Error("balance was not updated");
        const updated = await response.json();

        expect(updated.change?.amount).toBe(75000);
        expect(updated.change?.favourable).toBe(true);
    });

    it("writes the new balance to the database", async () => {
        const me = await createUser();
        const mine = signedIn(me);
        const account = await createAccount(me.id, { balance: euros(100) });

        await mine.accounts[":id"].$patch({
            param: { id: account.id },
            json: { balance: euros(250) },
        });

        const row = await stored(account.id);
        expect(row?.balance).toBe(25000);
        expect(row?.statedAt).toBeInstanceOf(Date);
    });

    it("never touches another user's account", async () => {
        const me = await createUser();
        const someoneElse = await createUser("someone@lofit.test");
        const theirs = await createAccount(someoneElse.id, { balance: euros(500) });

        const response = await signedIn(me).accounts[":id"].$patch({
            param: { id: theirs.id },
            json: { balance: euros(9999) },
        });

        expect(response.status).toBe(404);
        expect((await stored(theirs.id))?.balance).toBe(50000);
    });

    it("answers 404 for an id that does not exist", async () => {
        const me = await createUser();

        const response = await signedIn(me).accounts[":id"].$patch({
            param: { id: "00000000-0000-4000-8000-000000000000" },
            json: { balance: euros(10) },
        });

        expect(response.status).toBe(404);
    });
});
