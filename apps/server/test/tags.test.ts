import { describe, expect, it } from "vitest";
import { postRaw, signedIn } from "./client";
import { createTag, createUser } from "./factories";

describe("GET /api/tags", () => {
    it("lists the user's tags in their own order", async () => {
        const me = await createUser();
        const mine = signedIn(me);
        const someoneElse = await createUser("someone@lofit.test");
        await createTag(me.id, "Groceries", 1);
        await createTag(me.id, "Housing", 0);
        await createTag(someoneElse.id, "Not mine", 0);

        const response = await mine.tags.$get();

        expect(response.status).toBe(200);
        expect(await response.json()).toStrictEqual([
            { id: expect.any(String), name: "Housing", position: 0 },
            { id: expect.any(String), name: "Groceries", position: 1 },
        ]);
    });
});

describe("POST /api/tags", () => {
    it("creates a tag at the end of the order", async () => {
        const me = await createUser();
        const mine = signedIn(me);
        await createTag(me.id, "Housing", 0);

        const response = await mine.tags.$post({ json: { name: "Holiday" } });

        expect(response.status).toBe(201);
        expect(await response.json()).toStrictEqual({
            id: expect.any(String),
            name: "Holiday",
            position: 1,
        });
    });

    it("returns the tag you already have, whatever case you type", async () => {
        const me = await createUser();
        const mine = signedIn(me);
        const existing = await createTag(me.id, "Groceries", 0);

        const response = await mine.tags.$post({ json: { name: "  groceries " } });

        expect(response.status).toBe(200);
        expect(await response.json()).toStrictEqual({
            id: existing.id,
            name: "Groceries",
            position: 0,
        });
        expect((await (await mine.tags.$get()).json())).toHaveLength(1);
    });

    it("never reuses another user's tag", async () => {
        const me = await createUser();
        const mine = signedIn(me);
        const someoneElse = await createUser("someone@lofit.test");
        await createTag(someoneElse.id, "Groceries", 0);

        const response = await mine.tags.$post({ json: { name: "Groceries" } });

        expect(response.status).toBe(201);
    });

    it("rejects a blank name", async () => {
        const me = await createUser();

        const response = await postRaw("/api/tags", JSON.stringify({ name: "   " }), me.cookie);
        const body = (await response.json()) as { error: string; issues: { path: string }[] };

        expect(response.status).toBe(400);
        expect(body.issues.map((issue) => issue.path)).toEqual(["name"]);
    });
});
