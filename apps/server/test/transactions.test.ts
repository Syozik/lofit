import { euros } from "@lofit/domain";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "../src/db/client";
import { transactions } from "../src/db/schema";
import { signedIn } from "./client";
import { balanceOf, createAccount, createTag, createTransaction, createUser } from "./factories";

const transactionsOf = (userId: string) =>
    db.select().from(transactions).where(eq(transactions.userId, userId));

const july29 = "2026-07-29T17:42:00Z";

describe("GET /api/transactions", () => {
    it("returns the user's transactions, newest first, with their tags in order", async () => {
        const me = await createUser();
        const mine = signedIn(me);
        const someoneElse = await createUser("someone@lofit.test");
        const ing = await createAccount(me.id);
        const theirs = await createAccount(someoneElse.id);
        const housing = await createTag(me.id, "Housing", 0);
        const holiday = await createTag(me.id, "Holiday", 1);
        await createTransaction(
            me.id,
            ing.id,
            { name: "Huur", amount: euros(-1375), occurredAt: new Date("2026-07-01T09:05:00Z") },
            [housing.id, holiday.id],
        );
        await createTransaction(me.id, ing.id, {
            name: "Salaris",
            kind: "income",
            amount: euros(4150),
            occurredAt: new Date("2026-07-25T06:00:00Z"),
        });
        await createTransaction(someoneElse.id, theirs.id, { name: "Not mine" });

        const response = await mine.transactions.$get();

        expect(await response.json()).toStrictEqual([
            {
                id: expect.any(String),
                name: "Salaris",
                kind: "income",
                tagIds: [],
                accountId: ing.id,
                amount: 415000,
                occurredAt: "2026-07-25T06:00:00.000Z",
            },
            {
                id: expect.any(String),
                name: "Huur",
                kind: "expense",
                tagIds: [housing.id, holiday.id],
                accountId: ing.id,
                amount: -137500,
                occurredAt: "2026-07-01T09:05:00.000Z",
            },
        ]);
    });
});

describe("POST /api/transactions", () => {
    it("records a tagged expense and takes it off the account", async () => {
        const me = await createUser();
        const mine = signedIn(me);
        const ing = await createAccount(me.id, { balance: euros(100) });
        const groceries = await createTag(me.id);

        const response = await mine.transactions.$post({
            json: { name: "Albert Heijn", kind: "expense", tagIds: [groceries.id], accountId: ing.id, amount: -4218, occurredAt: july29 },
        });

        expect(response.status).toBe(201);
        expect(await response.json()).toStrictEqual({
            id: expect.any(String),
            name: "Albert Heijn",
            kind: "expense",
            tagIds: [groceries.id],
            accountId: ing.id,
            amount: -4218,
            occurredAt: "2026-07-29T17:42:00.000Z",
        });
        expect(await balanceOf(ing.id)).toBe(5782);
    });

    it("keeps several tags in the order they were chosen", async () => {
        const me = await createUser();
        const mine = signedIn(me);
        const ing = await createAccount(me.id);
        const groceries = await createTag(me.id, "Groceries", 0);
        const holiday = await createTag(me.id, "Holiday", 1);

        const response = await mine.transactions.$post({
            json: { name: "Toko", kind: "expense", tagIds: [holiday.id, groceries.id], accountId: ing.id, amount: -3460, occurredAt: july29 },
        });

        expect(response.status).toBe(201);
        if (!response.ok) throw new Error("expected the entry to be created");
        expect((await response.json()).tagIds).toEqual([holiday.id, groceries.id]);
        expect((await (await mine.transactions.$get()).json())[0]?.tagIds).toEqual([holiday.id, groceries.id]);
    });

    it("tags income as happily as spending", async () => {
        const me = await createUser();
        const mine = signedIn(me);
        const ing = await createAccount(me.id, { balance: euros(10) });
        const salary = await createTag(me.id, "Salary", 0, "income");

        const response = await mine.transactions.$post({
            json: { name: "Salaris", kind: "income", tagIds: [salary.id], accountId: ing.id, amount: 415000, occurredAt: july29 },
        });

        expect(response.status).toBe(201);
        expect(await balanceOf(ing.id)).toBe(416000);
    });

    it("moves a transfer out of one account and into the other", async () => {
        const me = await createUser();
        const mine = signedIn(me);
        const ing = await createAccount(me.id, { balance: euros(3240.18) });
        const savings = await createAccount(me.id, { name: "Spaarrekening", balance: euros(18500) });

        const response = await mine.transactions.$post({
            json: { name: "To savings", kind: "transfer", accountId: ing.id, toAccountId: savings.id, amount: -50000, occurredAt: july29 },
        });

        expect(response.status).toBe(201);
        expect([await balanceOf(ing.id), await balanceOf(savings.id)]).toEqual([274018, 1900000]);
    });

    it("pays down a loan: the current account drops and the debt moves toward zero", async () => {
        const me = await createUser();
        const mine = signedIn(me);
        const ing = await createAccount(me.id, { balance: euros(3240.18) });
        const loan = await createAccount(me.id, { name: "Studieschuld", balance: euros(-8750) });

        await mine.transactions.$post({
            json: { name: "DUO", kind: "transfer", accountId: ing.id, toAccountId: loan.id, amount: -14500, occurredAt: july29 },
        });

        expect([await balanceOf(ing.id), await balanceOf(loan.id)]).toEqual([309518, -860500]);
    });

    it("rejects an unknown tag and writes nothing", async () => {
        const me = await createUser();
        const mine = signedIn(me);
        const ing = await createAccount(me.id, { balance: euros(100) });

        const response = await mine.transactions.$post({
            json: { name: "Ghost tag", kind: "expense", tagIds: [crypto.randomUUID()], accountId: ing.id, amount: -1000, occurredAt: july29 },
        });

        expect(response.status).toBe(422);
        expect(await response.json()).toStrictEqual({ error: "Unknown tag" });
        expect(await balanceOf(ing.id)).toBe(10000);
        expect(await transactionsOf(me.id)).toHaveLength(0);
    });

    it("refuses another user's tag", async () => {
        const me = await createUser();
        const mine = signedIn(me);
        const someoneElse = await createUser("someone@lofit.test");
        const ing = await createAccount(me.id, { balance: euros(100) });
        const theirs = await createTag(someoneElse.id, "Theirs", 0);

        const response = await mine.transactions.$post({
            json: { name: "Borrowed tag", kind: "expense", tagIds: [theirs.id], accountId: ing.id, amount: -1000, occurredAt: july29 },
        });

        expect(response.status).toBe(422);
        expect(await transactionsOf(me.id)).toHaveLength(0);
    });

    it("rejects a transfer to an unknown account and writes nothing", async () => {
        const me = await createUser();
        const mine = signedIn(me);
        const ing = await createAccount(me.id, { balance: euros(100) });

        const response = await mine.transactions.$post({
            json: { name: "Ghost", kind: "transfer", accountId: ing.id, toAccountId: crypto.randomUUID(), amount: -5000, occurredAt: july29 },
        });

        expect(response.status).toBe(422);
        expect(await response.json()).toStrictEqual({ error: "Unknown account" });
        expect(await balanceOf(ing.id)).toBe(10000);
        expect(await transactionsOf(me.id)).toHaveLength(0);
    });

    it("refuses to touch another user's account", async () => {
        const me = await createUser();
        const mine = signedIn(me);
        const someoneElse = await createUser("someone@lofit.test");
        const ing = await createAccount(me.id, { balance: euros(100) });
        const theirs = await createAccount(someoneElse.id, { balance: euros(50) });

        const transfer = await mine.transactions.$post({
            json: { name: "Into theirs", kind: "transfer", accountId: ing.id, toAccountId: theirs.id, amount: -5000, occurredAt: july29 },
        });
        const expense = await mine.transactions.$post({
            json: { name: "On theirs", kind: "expense", accountId: theirs.id, amount: -1000, occurredAt: july29 },
        });

        expect([transfer.status, expense.status]).toEqual([422, 422]);
        expect([await balanceOf(ing.id), await balanceOf(theirs.id)]).toEqual([10000, 5000]);
        expect([...(await transactionsOf(me.id)), ...(await transactionsOf(someoneElse.id))]).toHaveLength(0);
    });

    it("rejects an entry that breaks the rules and says which field", async () => {
        const me = await createUser();
        const mine = signedIn(me);
        const ing = await createAccount(me.id, { balance: euros(100) });
        const groceries = await createTag(me.id);

        const response = await mine.transactions.$post({
            json: { name: "Twice tagged", kind: "expense", tagIds: [groceries.id, groceries.id], accountId: ing.id, amount: -1000, occurredAt: july29 },
        });

        expect(response.status).toBe(400);
        expect(await response.json()).toStrictEqual({
            error: "Invalid request",
            issues: [{ path: "tagIds", message: "The same tag twice" }],
        });
        expect(await balanceOf(ing.id)).toBe(10000);
    });
});

describe("DELETE /api/transactions/:id", () => {
    it("leaves the balance exactly where posting found it", async () => {
        const me = await createUser();
        const mine = signedIn(me);
        const account = await createAccount(me.id, { balance: euros(3240.18) });

        const posted = await mine.transactions.$post({
            json: {
                name: "Albert Heijn",
                kind: "expense",
                tagIds: [],
                accountId: account.id,
                amount: euros(-40),
                occurredAt: "2026-07-15T12:00:00Z",
            },
        });
        if (!posted.ok) throw new Error("the entry was not posted");
        expect(await balanceOf(account.id)).toBe(320018);

        const entry = await posted.json();
        const response = await mine.transactions[":id"].$delete({ param: { id: entry.id } });

        expect(response.status).toBe(204);
        expect(await balanceOf(account.id)).toBe(324018);
        expect((await (await mine.transactions.$get()).json())).toHaveLength(0);
    });

    it("moves a transfer back out of both accounts", async () => {
        const me = await createUser();
        const mine = signedIn(me);
        const from = await createAccount(me.id, { name: "ING", balance: euros(1000) });
        const to = await createAccount(me.id, { name: "Revolut", balance: euros(100) });

        const posted = await mine.transactions.$post({
            json: {
                name: "To Revolut",
                kind: "transfer",
                tagIds: [],
                accountId: from.id,
                toAccountId: to.id,
                amount: euros(-250),
                occurredAt: "2026-07-15T12:00:00Z",
            },
        });
        if (!posted.ok) throw new Error("the transfer was not posted");
        expect(await balanceOf(from.id)).toBe(75000);
        expect(await balanceOf(to.id)).toBe(35000);

        const entry = await posted.json();
        await mine.transactions[":id"].$delete({ param: { id: entry.id } });

        expect(await balanceOf(from.id)).toBe(100000);
        expect(await balanceOf(to.id)).toBe(10000);
    });

    it("never deletes another user's entry", async () => {
        const me = await createUser();
        const someoneElse = await createUser("someone@lofit.test");
        const theirAccount = await createAccount(someoneElse.id, { balance: euros(500) });
        const theirs = await createTransaction(someoneElse.id, theirAccount.id, {
            amount: euros(-20),
        });

        const response = await signedIn(me).transactions[":id"].$delete({
            param: { id: theirs.id },
        });

        expect(response.status).toBe(404);
        expect(await balanceOf(theirAccount.id)).toBe(50000);
    });

    it("answers 404 the second time", async () => {
        const me = await createUser();
        const mine = signedIn(me);
        const account = await createAccount(me.id);
        const entry = await createTransaction(me.id, account.id, { amount: euros(-10) });

        expect((await mine.transactions[":id"].$delete({ param: { id: entry.id } })).status).toBe(204);
        expect((await mine.transactions[":id"].$delete({ param: { id: entry.id } })).status).toBe(404);
    });
});
