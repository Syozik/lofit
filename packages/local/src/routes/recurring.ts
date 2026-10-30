import { following } from "@lofit/domain";
import { newRecurringSchema, recurringPatchSchema } from "@lofit/domain/schemas";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { idParam, invalidBody, readJson } from "../http";
import { newId } from "../ids";
import { logDue, toRecurring } from "../recurring";
import { today } from "../store";
import type { Store, StoredRecurring } from "../store";

export function recurringRoute(store: Store) {
    const { data } = store;

    async function settle(): Promise<void> {
        logDue(data, today());
        await store.save("recurring", "transactions", "accounts");
    }

    return new Hono()
        .get("/", (c) =>
            c.json(
                [...data.recurring]
                    .sort((a, b) => (a.nextDue < b.nextDue ? -1 : a.nextDue > b.nextDue ? 1 : a.name.localeCompare(b.name)))
                    .map(toRecurring),
            ),
        )
        .post("/", async (c) => {
            const parsed = await readJson(c, newRecurringSchema);
            if (!parsed.success) return invalidBody(c, parsed.error.issues);
            const draft = parsed.data;

            const existing = draft.id ? data.recurring.find((item) => item.id === draft.id) : undefined;
            if (existing) return c.json(toRecurring(existing), 200);

            const owned = new Set(data.accounts.map((account) => account.id));
            if (!owned.has(draft.accountId) || (draft.toAccountId && !owned.has(draft.toAccountId))) {
                throw new HTTPException(422, { message: "Unknown account" });
            }

            const created: StoredRecurring = {
                id: draft.id ?? newId(),
                name: draft.name,
                kind: draft.kind,
                tagIds: [...draft.tagIds],
                accountId: draft.accountId,
                ...(draft.toAccountId ? { toAccountId: draft.toAccountId } : {}),
                amount: draft.amount,
                currency: draft.currency,
                cadence: draft.cadence,
                anchor: draft.anchor,
                nextDue: following(draft.anchor, draft.cadence),
                paused: false,
            };
            data.recurring.push(created);
            await settle();

            return c.json(toRecurring(data.recurring.find((item) => item.id === created.id) ?? created), 201);
        })
        .patch("/:id", async (c) => {
            const id = idParam(c, "id", "No such recurring entry");
            const parsed = await readJson(c, recurringPatchSchema);
            if (!parsed.success) return invalidBody(c, parsed.error.issues);
            const patch = parsed.data;

            const current = data.recurring.find((item) => item.id === id);
            if (!current) throw new HTTPException(404, { message: "No such recurring entry" });

            const amount = patch.amount ?? current.amount;
            if (current.kind === "income" ? amount <= 0 : amount >= 0) {
                throw new HTTPException(422, { message: "Income is positive; expenses and transfers are negative" });
            }

            const updated: StoredRecurring = {
                ...current,
                ...(patch.name ? { name: patch.name } : {}),
                amount,
                ...(patch.cadence ? { cadence: patch.cadence } : {}),
                ...(patch.nextDue ? { nextDue: patch.nextDue, anchor: patch.nextDue } : {}),
                ...(patch.paused !== undefined ? { paused: patch.paused } : {}),
            };
            data.recurring = data.recurring.map((item) => (item.id === id ? updated : item));
            await settle();

            return c.json(toRecurring(data.recurring.find((item) => item.id === id) ?? updated));
        })
        .delete("/:id", async (c) => {
            const id = idParam(c, "id", "No such recurring entry");
            if (!data.recurring.some((item) => item.id === id)) {
                throw new HTTPException(404, { message: "No such recurring entry" });
            }
            data.recurring = data.recurring.filter((item) => item.id !== id);
            await store.save("recurring");
            return c.body(null, 204);
        });
}
