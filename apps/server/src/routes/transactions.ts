import { zValidator } from "@hono/zod-validator";
import { balanceChanges, negateCents } from "@lofit/domain";
import { newTransactionSchema } from "@lofit/domain/schemas";
import { z } from "zod";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { AuthEnv } from "../auth/session";
import { db } from "../db/client";
import { toTransaction } from "../db/mappers";
import { accounts, tags, transactions, transactionTags } from "../db/schema";
import { invalidBody } from "../http";

export const transactionsRoute = new Hono<AuthEnv>()
    .get("/", async (c) => {
        const userId = c.var.userId;

        const rows = await db
            .select()
            .from(transactions)
            .where(eq(transactions.userId, userId))
            .orderBy(desc(transactions.occurredAt), desc(transactions.createdAt));

        const tagged = await db
            .select({ transactionId: transactionTags.transactionId, tagId: transactionTags.tagId })
            .from(transactionTags)
            .where(eq(transactionTags.userId, userId))
            .orderBy(asc(transactionTags.position));

        const tagIds = new Map<string, string[]>();
        for (const row of tagged) {
            const existing = tagIds.get(row.transactionId);
            if (existing) existing.push(row.tagId);
            else tagIds.set(row.transactionId, [row.tagId]);
        }

        return c.json(rows.map((row) => toTransaction(row, tagIds.get(row.id) ?? [])));
    })
    .post(
        "/",
        zValidator("json", newTransactionSchema, (result, c) => {
            if (!result.success) return invalidBody(c, result.error.issues);
        }),
        async (c) => {
            const entry = c.req.valid("json");
            const userId = c.var.userId;
            const changes = balanceChanges(entry);

            const row = await db.transaction(async (tx) => {
                const owned = await tx
                    .select({ id: accounts.id })
                    .from(accounts)
                    .where(and(eq(accounts.userId, userId), inArray(accounts.id, changes.map((change) => change.accountId))));

                if (owned.length !== changes.length) {
                    throw new HTTPException(422, { message: "Unknown account" });
                }

                if (entry.tagIds.length > 0) {
                    const ownedTags = await tx
                        .select({ id: tags.id })
                        .from(tags)
                        .where(and(eq(tags.userId, userId), inArray(tags.id, entry.tagIds)));

                    if (ownedTags.length !== entry.tagIds.length) {
                        throw new HTTPException(422, { message: "Unknown tag" });
                    }
                }

                const [inserted] = await tx
                    .insert(transactions)
                    .values({
                        userId,
                        name: entry.name,
                        kind: entry.kind,
                        accountId: entry.accountId,
                        toAccountId: entry.toAccountId ?? null,
                        amount: entry.amount,
                        occurredAt: new Date(entry.occurredAt),
                    })
                    .returning();
                if (!inserted) throw new Error("Inserting a transaction returned no row.");

                if (entry.tagIds.length > 0) {
                    await tx.insert(transactionTags).values(
                        entry.tagIds.map((tagId, position) => ({
                            transactionId: inserted.id,
                            tagId,
                            userId,
                            position,
                        })),
                    );
                }

                for (const change of changes) {
                    await tx
                        .update(accounts)
                        .set({ balance: sql`${accounts.balance} + ${change.delta}` })
                        .where(and(eq(accounts.id, change.accountId), eq(accounts.userId, userId)));
                }

                return inserted;
            });

            if (!row) throw new Error("Inserting a transaction returned no row.");

            return c.json(toTransaction(row, entry.tagIds), 201);
        },
    )
    .patch(
        "/:id",
        zValidator("param", z.object({ id: z.uuid() }), (result) => {
            if (!result.success) throw new HTTPException(404, { message: "No such transaction" });
        }),
        zValidator("json", newTransactionSchema, (result, c) => {
            if (!result.success) return invalidBody(c, result.error.issues);
        }),
        async (c) => {
            const id = c.req.param("id");
            const entry = c.req.valid("json");
            const userId = c.var.userId;
            const wanted = balanceChanges(entry);

            const row = await db.transaction(async (tx) => {
                const [current] = await tx
                    .select()
                    .from(transactions)
                    .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
                    .limit(1);

                if (!current) throw new HTTPException(404, { message: "No such transaction" });

                const owned = await tx
                    .select({ id: accounts.id })
                    .from(accounts)
                    .where(and(eq(accounts.userId, userId), inArray(accounts.id, wanted.map((change) => change.accountId))));

                if (owned.length !== wanted.length) {
                    throw new HTTPException(422, { message: "Unknown account" });
                }

                if (entry.tagIds.length > 0) {
                    const ownedTags = await tx
                        .select({ id: tags.id })
                        .from(tags)
                        .where(and(eq(tags.userId, userId), inArray(tags.id, entry.tagIds)));

                    if (ownedTags.length !== entry.tagIds.length) {
                        throw new HTTPException(422, { message: "Unknown tag" });
                    }
                }

                const undo = balanceChanges({
                    accountId: current.accountId,
                    toAccountId: current.toAccountId ?? undefined,
                    amount: current.amount,
                });

                for (const change of undo) {
                    await tx
                        .update(accounts)
                        .set({ balance: sql`${accounts.balance} + ${negateCents(change.delta)}` })
                        .where(and(eq(accounts.id, change.accountId), eq(accounts.userId, userId)));
                }

                const [updated] = await tx
                    .update(transactions)
                    .set({
                        name: entry.name,
                        kind: entry.kind,
                        accountId: entry.accountId,
                        toAccountId: entry.toAccountId ?? null,
                        amount: entry.amount,
                        occurredAt: new Date(entry.occurredAt),
                    })
                    .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
                    .returning();
                if (!updated) throw new Error("Updating a transaction returned no row.");

                await tx.delete(transactionTags).where(eq(transactionTags.transactionId, id));

                if (entry.tagIds.length > 0) {
                    await tx.insert(transactionTags).values(
                        entry.tagIds.map((tagId, position) => ({
                            transactionId: id,
                            tagId,
                            userId,
                            position,
                        })),
                    );
                }

                for (const change of wanted) {
                    await tx
                        .update(accounts)
                        .set({ balance: sql`${accounts.balance} + ${change.delta}` })
                        .where(and(eq(accounts.id, change.accountId), eq(accounts.userId, userId)));
                }

                return updated;
            });

            return c.json(toTransaction(row, entry.tagIds));
        },
    )
    .delete(
        "/:id",
        zValidator("param", z.object({ id: z.uuid() }), (result) => {
            if (!result.success) throw new HTTPException(404, { message: "No such transaction" });
        }),
        async (c) => {
            const id = c.req.param("id");
            const userId = c.var.userId;

            await db.transaction(async (tx) => {
                const [gone] = await tx
                    .delete(transactions)
                    .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
                    .returning();

                if (!gone) throw new HTTPException(404, { message: "No such transaction" });

                const changes = balanceChanges({
                    accountId: gone.accountId,
                    toAccountId: gone.toAccountId ?? undefined,
                    amount: gone.amount,
                });

                for (const change of changes) {
                    await tx
                        .update(accounts)
                        .set({ balance: sql`${accounts.balance} + ${negateCents(change.delta)}` })
                        .where(and(eq(accounts.id, change.accountId), eq(accounts.userId, userId)));
                }
            });

            return c.body(null, 204);
        },
    );
