import { euros } from "@lofit/domain";
import { describe, expect, it } from "vitest";
import { db } from "../src/db/client";
import { tags, transactionTags } from "../src/db/schema";
import { createAccount, createHolding, createTag, createTransaction, createUser, firstGroup } from "./factories";

async function violatedConstraint(write: PromiseLike<unknown>): Promise<string | undefined> {
    try {
        await write;
        return undefined;
    } catch (error) {
        const cause = (error as { cause?: unknown }).cause ?? error;
        return (cause as { constraint_name?: string }).constraint_name;
    }
}

describe("database constraints", () => {
    it("accept a valid tagged transaction", async () => {
        const me = await createUser();
        const ing = await createAccount(me.id);
        const tag = await createTag(me.id);

        expect(await violatedConstraint(createTransaction(me.id, ing.id, {}, [tag.id]))).toBeUndefined();
    });

    it("keep a transaction from pointing at another user's account", async () => {
        const me = await createUser();
        const someoneElse = await createUser("someone@lofit.test");
        const theirs = await createAccount(someoneElse.id);

        expect(await violatedConstraint(createTransaction(me.id, theirs.id))).toBe("transactions_account_fk");
    });

    it("keep a transaction from using another user's tag", async () => {
        const me = await createUser();
        const someoneElse = await createUser("someone@lofit.test");
        const ing = await createAccount(me.id);
        const theirs = await createTag(someoneElse.id);

        expect(await violatedConstraint(createTransaction(me.id, ing.id, {}, [theirs.id]))).toBe("transaction_tags_tag_fk");
    });

    it("let only one tag own the money", async () => {
        const me = await createUser();
        const ing = await createAccount(me.id);
        const groceries = await createTag(me.id, "Groceries", 0);
        const holiday = await createTag(me.id, "Holiday", 1);
        const transaction = await createTransaction(me.id, ing.id, {}, [groceries.id]);

        const second = db.insert(transactionTags).values({
            transactionId: transaction.id,
            tagId: holiday.id,
            userId: me.id,
            position: 0,
        });

        expect(await violatedConstraint(second)).toBe("transaction_tags_one_owner");
    });

    it("allow one tag per name per user, whatever the case", async () => {
        const me = await createUser();
        await createTag(me.id, "Housing", 0);

        const duplicate = db.insert(tags).values({ userId: me.id, name: "housing", position: 1 });

        expect(await violatedConstraint(duplicate)).toBe("tags_user_name_unique");
    });

    it("allow one position per instrument per account", async () => {
        const me = await createUser();
        const degiro = await createAccount(me.id, { name: "DEGIRO" });
        await createHolding(me.id, { symbol: "ASML", accountId: degiro.id });

        expect(
            await violatedConstraint(createHolding(me.id, { symbol: "ASML", accountId: degiro.id })),
        ).toBe("holdings_position_unique");
    });

    it("require a positive quantity", async () => {
        const me = await createUser();

        expect(await violatedConstraint(createHolding(me.id, { quantity: 0 }))).toBe("holdings_quantity_positive");
    });

});
