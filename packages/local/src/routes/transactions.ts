import { addCents, balanceChanges, negateCents } from "@lofit/domain";
import type { BalanceChange } from "@lofit/domain";
import { newTransactionSchema } from "@lofit/domain/schemas";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { z } from "zod";
import { idParam, invalidBody, readJson } from "../http";
import { newId } from "../ids";
import { toTransaction } from "../mappers";
import type { Ledger, Store, StoredTransaction } from "../store";

type Entry = z.output<typeof newTransactionSchema>;

function checkReferences(data: Ledger, entry: Entry, changes: readonly BalanceChange[]): void {
    const owned = new Set(data.accounts.map((account) => account.id));
    if (!changes.every((change) => owned.has(change.accountId))) {
        throw new HTTPException(422, { message: "Unknown account" });
    }

    if (entry.tagIds.length === 0) return;

    const kinds = new Map(data.tags.map((tag) => [tag.id, tag.kind]));
    const found = entry.tagIds.map((tagId) => kinds.get(tagId));
    if (found.some((kind) => kind === undefined)) {
        throw new HTTPException(422, { message: "Unknown tag" });
    }
    if (found.some((kind) => kind !== entry.kind)) {
        throw new HTTPException(422, { message: `Only ${entry.kind} tags fit this entry` });
    }
}

function apply(data: Ledger, changes: readonly BalanceChange[], undo: boolean): void {
    for (const change of changes) {
        const delta = undo ? negateCents(change.delta) : change.delta;
        data.accounts = data.accounts.map((account) =>
            account.id === change.accountId
                ? { ...account, balance: addCents(account.balance, delta) }
                : account,
        );
    }
}

function fields(entry: Entry) {
    return {
        name: entry.name,
        kind: entry.kind,
        tagIds: [...entry.tagIds],
        accountId: entry.accountId,
        ...(entry.toAccountId ? { toAccountId: entry.toAccountId } : {}),
        amount: entry.amount,
        occurredAt: new Date(entry.occurredAt).toISOString(),
    };
}

function newestFirst(a: StoredTransaction, b: StoredTransaction): number {
    if (a.occurredAt !== b.occurredAt) return a.occurredAt < b.occurredAt ? 1 : -1;
    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
    return 0;
}

export function transactionsRoute(store: Store) {
    const { data } = store;

    return new Hono()
        .get("/", (c) => c.json([...data.transactions].sort(newestFirst).map(toTransaction)))
        .post("/", async (c) => {
            const parsed = await readJson(c, newTransactionSchema);
            if (!parsed.success) return invalidBody(c, parsed.error.issues);
            const entry = parsed.data;
            if (entry.currency && entry.currency !== store.settings.currency) {
                throw new HTTPException(422, { message: "Other currencies need an account" });
            }
            const changes = balanceChanges(entry);

            if (entry.id) {
                const existing = data.transactions.find((stored) => stored.id === entry.id);
                if (existing) return c.json(toTransaction({ ...existing, tagIds: entry.tagIds }), 200);
            }

            checkReferences(data, entry, changes);

            const created: StoredTransaction = {
                id: entry.id ?? newId(),
                ...fields(entry),
                createdAt: new Date().toISOString(),
            };
            data.transactions.push(created);
            apply(data, changes, false);
            await store.save("transactions", "accounts");

            return c.json(toTransaction(created), 201);
        })
        .patch("/:id", async (c) => {
            const id = idParam(c, "id", "No such transaction");
            const parsed = await readJson(c, newTransactionSchema);
            if (!parsed.success) return invalidBody(c, parsed.error.issues);
            const entry = parsed.data;
            if (entry.currency && entry.currency !== store.settings.currency) {
                throw new HTTPException(422, { message: "Other currencies need an account" });
            }
            const wanted = balanceChanges(entry);

            const index = data.transactions.findIndex((stored) => stored.id === id);
            const current = data.transactions[index];
            if (!current) throw new HTTPException(404, { message: "No such transaction" });

            checkReferences(data, entry, wanted);

            apply(data, balanceChanges(current), true);
            const updated: StoredTransaction = { id, ...fields(entry), createdAt: current.createdAt };
            data.transactions[index] = updated;
            apply(data, wanted, false);
            await store.save("transactions", "accounts");

            return c.json(toTransaction(updated));
        })
        .delete("/:id", async (c) => {
            const id = idParam(c, "id", "No such transaction");

            const gone = data.transactions.find((stored) => stored.id === id);
            if (!gone) throw new HTTPException(404, { message: "No such transaction" });

            data.transactions = data.transactions.filter((stored) => stored.id !== id);
            apply(data, balanceChanges(gone), true);
            await store.save("transactions", "accounts");

            return c.body(null, 204);
        });
}
