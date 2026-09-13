import { describe, expect, it } from "vitest";
import { api, postRaw } from "./client";
import { createUser } from "./factories";

describe("GET /api/health", () => {
    it("answers without a signed-in user", async () => {
        const response = await api.health.$get();

        expect(response.status).toBe(200);
        expect(await response.json()).toStrictEqual({ ok: true });
    });
});

describe("errors", () => {
    it("turn an unsigned-in request away", async () => {
        const response = await api.accounts.$get();

        expect(response.status).toBe(401);
        expect(await response.json()).toStrictEqual({ error: "Sign in required" });
    });

    it("answer malformed JSON with a JSON error", async () => {
        const me = await createUser();

        const response = await postRaw("/api/transactions", "{not json", me.cookie);

        expect(response.status).toBe(400);
        expect(await response.json()).toStrictEqual({ error: "Malformed JSON in request body" });
    });
});
