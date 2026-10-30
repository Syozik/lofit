import { addCents, balanceChanges, negateCents, restated } from "@lofit/domain";
import { accountBalanceSchema, newAccountSchema } from "@lofit/domain/schemas";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { idParam, invalidBody, readJson } from "../http";
import { newId } from "../ids";
import { toAccount } from "../mappers";
import type { Store, StoredAccount } from "../store";

function compare(a: string | number, b: string | number): number {
    return a < b ? -1 : a > b ? 1 : 0;
}

export function accountsRoute(store: Store) {
    const { data } = store;

    return new Hono()
        .get("/", (c) => {
            const position = new Map(data.groups.map((group) => [group.id, group.position]));
            const rows = data.accounts
                .filter((account) => position.has(account.groupId))
                .sort(
                    (a, b) =>
                        compare(position.get(a.groupId) ?? 0, position.get(b.groupId) ?? 0) ||
                        compare(a.createdAt, b.createdAt) ||
                        compare(a.name, b.name),
                );

            return c.json(rows.map(toAccount));
        })
        .post("/", async (c) => {
            const parsed = await readJson(c, newAccountSchema);
            if (!parsed.success) return invalidBody(c, parsed.error.issues);
            const draft = parsed.data;

            if (draft.id) {
                const same = data.accounts.find((account) => account.id === draft.id);
                if (same) return c.json(toAccount(same), 200);
            }

            if (!data.groups.some((group) => group.id === draft.groupId)) {
                throw new HTTPException(422, { message: "Unknown group" });
            }

            const now = new Date().toISOString();
            const created: StoredAccount = {
                id: draft.id ?? newId(),
                name: draft.name,
                subtitle: draft.subtitle,
                groupId: draft.groupId,
                balance: draft.balance,
                provenance: "manual",
                statedAt: now,
                createdAt: now,
            };
            data.accounts.push(created);
            await store.save("accounts");

            return c.json(toAccount(created), 201);
        })
        .patch("/:id", async (c) => {
            const id = idParam(c, "id", "No such account");
            const parsed = await readJson(c, accountBalanceSchema);
            if (!parsed.success) return invalidBody(c, parsed.error.issues);

            const index = data.accounts.findIndex((account) => account.id === id);
            const current = data.accounts[index];
            if (!current) throw new HTTPException(404, { message: "No such account" });

            const now = new Date().toISOString();
            const since = current.statedAt ?? current.lastSyncedAt ?? current.createdAt;
            const next = restated(toAccount(current), parsed.data.balance, now, since);
            const updated: StoredAccount = { ...current, balance: next.balance, statedAt: now };
            if (next.change) updated.change = next.change;
            data.accounts[index] = updated;
            await store.save("accounts");

            return c.json(toAccount(updated));
        })
        .delete("/:id", async (c) => {
            const id = idParam(c, "id", "No such account");

            if (!data.accounts.some((account) => account.id === id)) {
                throw new HTTPException(404, { message: "No such account" });
            }

            const kept = data.transactions.filter(
                (entry) => entry.accountId !== id && entry.toAccountId !== id,
            );
            for (const entry of data.transactions) {
                if (kept.includes(entry)) continue;
                for (const change of balanceChanges(entry)) {
                    if (change.accountId === id) continue;
                    data.accounts = data.accounts.map((account) =>
                        account.id === change.accountId
                            ? { ...account, balance: addCents(account.balance, negateCents(change.delta)) }
                            : account,
                    );
                }
            }
            const gone = data.transactions.length - kept.length;
            data.transactions = kept;
            data.accounts = data.accounts.filter((account) => account.id !== id);
            data.recurring = data.recurring.filter((item) => item.accountId !== id && item.toAccountId !== id);
            await store.save("accounts", "transactions", "recurring");

            return c.json({ transactions: gone, holdings: 0 });
        });
}
