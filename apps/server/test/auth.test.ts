import { DEFAULT_TAG_NAMES, euros } from "@lofit/domain";
import { describe, expect, it } from "vitest";
import { app } from "../src/app";
import { api, signedIn } from "./client";
import { createAccount, createUser, TEST_PASSWORD } from "./factories";

const ORIGIN = "http://localhost:8787";

function authRequest(path: string, body: unknown, cookie?: string) {
    return app.request(`/api/auth${path}`, {
        method: "POST",
        headers: {
            "content-type": "application/json",
            origin: ORIGIN,
            ...(cookie ? { cookie } : {}),
        },
        body: JSON.stringify(body),
    });
}

function cookieFrom(response: Response): string {
    return response.headers
        .getSetCookie()
        .map((entry) => entry.split(";")[0])
        .join("; ");
}

describe("sign-up", () => {
    it("opens an account that can read its own, empty, books", async () => {
        const response = await authRequest("/sign-up/email", {
            name: "Nieuwe",
            email: "nieuwe@lofit.test",
            password: "een-goed-wachtwoord",
        });

        expect(response.status).toBe(200);

        const theirs = signedIn({ cookie: cookieFrom(response) });
        const accounts = await theirs.accounts.$get();

        expect(accounts.status).toBe(200);
        expect(await accounts.json()).toEqual([]);
    });

    it("gives the new account the default tags, in order", async () => {
        const response = await authRequest("/sign-up/email", {
            name: "Nieuwe",
            email: "nieuwe@lofit.test",
            password: "een-goed-wachtwoord",
        });

        const theirs = signedIn({ cookie: cookieFrom(response) });
        const tags = await (await theirs.tags.$get()).json();

        expect(tags.map((tag) => tag.name)).toEqual([...DEFAULT_TAG_NAMES]);
        expect(tags.map((tag) => tag.position)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    });

    it("refuses an email that already has an account", async () => {
        const me = await createUser();

        const response = await authRequest("/sign-up/email", {
            name: "Again",
            email: me.email,
            password: "een-goed-wachtwoord",
        });

        expect(response.status).toBe(422);
    });
});

describe("sign-in", () => {
    it("hands back a session that reaches the user's own data", async () => {
        const me = await createUser();
        await createAccount(me.id, { name: "ING", balance: euros(120) });

        const response = await authRequest("/sign-in/email", {
            email: me.email,
            password: TEST_PASSWORD,
        });

        expect(response.status).toBe(200);

        const mine = signedIn({ cookie: cookieFrom(response) });
        const accounts = await mine.accounts.$get();

        expect((await accounts.json()).map((account) => account.name)).toEqual(["ING"]);
    });

    it("turns away the wrong password", async () => {
        const me = await createUser();

        const response = await authRequest("/sign-in/email", {
            email: me.email,
            password: "not-the-password",
        });

        expect(response.status).toBe(401);
    });

    it("turns away an email nobody has", async () => {
        const response = await authRequest("/sign-in/email", {
            email: "nobody@lofit.test",
            password: TEST_PASSWORD,
        });

        expect(response.status).toBe(401);
    });
});

describe("sign-out", () => {
    it("ends the session it was given", async () => {
        const me = await createUser();
        const mine = signedIn(me);

        expect((await mine.accounts.$get()).status).toBe(200);

        const response = await authRequest("/sign-out", {}, me.cookie);
        expect(response.status).toBe(200);

        expect((await mine.accounts.$get()).status).toBe(401);
    });
});

describe("sessions", () => {
    it("never show one user the other's accounts", async () => {
        const me = await createUser();
        const someoneElse = await createUser("someone@lofit.test");
        await createAccount(me.id, { name: "Mine" });
        await createAccount(someoneElse.id, { name: "Theirs" });

        const mine = await signedIn(me).accounts.$get();
        const theirs = await signedIn(someoneElse).accounts.$get();

        expect((await mine.json()).map((account) => account.name)).toEqual(["Mine"]);
        expect((await theirs.json()).map((account) => account.name)).toEqual(["Theirs"]);
    });

    it("reject a made-up session token", async () => {
        const response = await app.request("/api/accounts", {
            headers: { cookie: "better-auth.session_token=not-a-real-token" },
        });

        expect(response.status).toBe(401);
    });

    it("let the health check through without one", async () => {
        expect((await api.health.$get()).status).toBe(200);
    });
});
