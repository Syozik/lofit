import { hc } from "hono/client";
import { testClient } from "hono/testing";
import { app } from "../src/app";
import type { AppType } from "../src/app";

export const api = testClient(app).api;

export function signedIn({ cookie }: { cookie: string }) {
    return hc<AppType>("http://localhost", { fetch: app.request, headers: { cookie } }).api;
}

export function postRaw(path: string, body: string, cookie?: string) {
    return app.request(path, {
        method: "POST",
        headers: cookie
            ? { "content-type": "application/json", cookie }
            : { "content-type": "application/json" },
        body,
    });
}
