import { euros } from "@lofit/domain";
import { describe, expect, it } from "vitest";
import { db } from "../src/db/client";
import { budgets, snapshots } from "../src/db/schema";
import { signedIn } from "./client";
import { createGroup, createTag, createUser, firstGroup } from "./factories";

describe("GET /api/budgets", () => {
    it("lists the user's budgets in tag order", async () => {
        const me = await createUser();
        const mine = signedIn(me);
        const someoneElse = await createUser("someone@lofit.test");
        const housing = await createTag(me.id, "Housing", 0);
        const groceries = await createTag(me.id, "Groceries", 1);
        const other = await createTag(me.id, "Other", 2);
        const theirs = await createTag(someoneElse.id, "Transport", 0);
        await db.insert(budgets).values([
            { userId: me.id, tagId: other.id, limit: euros(200) },
            { userId: me.id, tagId: housing.id, limit: euros(1400) },
            { userId: me.id, tagId: groceries.id, limit: euros(450) },
            { userId: someoneElse.id, tagId: theirs.id, limit: euros(150) },
        ]);

        const response = await mine.budgets.$get();

        expect(await response.json()).toStrictEqual([
            { tagId: housing.id, limit: 140000 },
            { tagId: groceries.id, limit: 45000 },
            { tagId: other.id, limit: 20000 },
        ]);
    });
});

describe("GET /api/snapshots", () => {
    it("lists the user's closed months, oldest first", async () => {
        const me = await createUser();
        const mine = signedIn(me);
        const someoneElse = await createUser("someone@lofit.test");
        const cash = await firstGroup(me.id);
        const debt = await createGroup(me.id, "Debt", 2);
        const theirCash = await firstGroup(someoneElse.id);

        await db.insert(snapshots).values([
            { userId: me.id, period: "2026-07", groupId: cash.id, amount: euros(22582.73) },
            { userId: me.id, period: "2026-07", groupId: debt.id, amount: euros(-10034.4) },
            { userId: me.id, period: "2025-08", groupId: cash.id, amount: euros(17250.1) },
            { userId: someoneElse.id, period: "2026-01", groupId: theirCash.id, amount: euros(1) },
        ]);

        const response = await mine.snapshots.$get();

        expect(await response.json()).toStrictEqual([
            { period: "2025-08", groups: [{ groupId: cash.id, amount: 1725010 }] },
            {
                period: "2026-07",
                groups: [
                    { groupId: cash.id, amount: 2258273 },
                    { groupId: debt.id, amount: -1003440 },
                ],
            },
        ]);
    });
});
