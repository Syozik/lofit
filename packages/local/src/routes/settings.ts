import { settingsSchema } from "@lofit/domain/schemas";
import { Hono } from "hono";
import { invalidBody, readJson } from "../http";
import type { Store } from "../store";

export function settingsRoute(store: Store) {
    return new Hono()
        .get("/", (c) => c.json(store.settings))
        .patch("/", async (c) => {
            const parsed = await readJson(c, settingsSchema);
            if (!parsed.success) return invalidBody(c, parsed.error.issues);

            store.settings.currency = parsed.data.currency;
            await store.saveSettings();

            return c.json(store.settings);
        });
}
