import { zValidator } from "@hono/zod-validator";
import { balanceChanges, negateCents, toBase } from "@lofit/domain";
import type { Cents } from "@lofit/domain";
import { newTransactionSchema } from "@lofit/domain/schemas";
import { z } from "zod";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { AuthEnv } from "../auth/session";
import { db } from "../db/client";
import { toTransaction } from "../db/mappers";
import { viewFor } from "../db/view";
import { accounts, tags, transactions, transactionTags } from "../db/schema";
import { invalidBody } from "../http";
import { perBaseOn } from "../prices/history";

type Entry = z.output<typeof newTransactionSchema>;

type Booked = Omit<Entry, "toAmount"> & {
    toAmount: Cents | null;
    original: { amount: Cents; currency: string } | null;
    bookedIn: string;
};

async function currenciesOf(userId: string): Promise<Map<string, string>> {
    const rows = await db
        .select({ id: accounts.id, currency: accounts.currency })
        .from(accounts)
        .where(eq(accounts.userId, userId));
    return new Map(rows.map((row) => [row.id, row.currency]));
}

async function converted(amount: Cents, from: string, to: string, day: string): Promise<Cents> {
    const rate = await perBaseOn(from, to, day);
    if (!rate) throw new HTTPException(422, { message: `No exchange rate from ${from} to ${to}` });
    return toBase(amount, rate);
}

async function booked(entry: Entry, owned: Map<string, string>, display: string): Promise<Booked> {
    const currency = owned.get(entry.accountId);
    if (!currency) throw new HTTPException(422, { message: "Unknown account" });
    const target = entry.toAccountId ? owned.get(entry.toAccountId) : undefined;
    if (entry.toAccountId && !target) throw new HTTPException(422, { message: "Unknown account" });

    const day = entry.occurredAt.slice(0, 10);
    const paid = entry.currency ?? display;
    const amount = paid === currency ? entry.amount : await converted(entry.amount, paid, currency, day);
    const original = paid === currency ? null : { amount: entry.amount, currency: paid };

    let toAmount: Cents | null = null;
    if (target && target !== currency) {
        toAmount = entry.toAmount ?? (await converted(negateCents(amount), currency, target, day));
    }

    return { ...entry, amount, toAmount, original, bookedIn: currency };
}

function moves(row: { accountId: string; toAccountId: string | null; amount: Cents; toAmount: Cents | null }) {
    return balanceChanges({
        accountId: row.accountId,
        toAccountId: row.toAccountId ?? undefined,
        amount: row.amount,
        toAmount: row.toAmount ?? undefined,
    });
}

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

        const owned = await currenciesOf(userId);
        const view = await viewFor(userId, c.var.currency, rows.at(-1)?.occurredAt.toISOString().slice(0, 10));
        return c.json(
            rows.map((row) => toTransaction(row, tagIds.get(row.id) ?? [], owned.get(row.accountId), view)),
        );
    })
    .post(
        "/",
        zValidator("json", newTransactionSchema, (result, c) => {
            if (!result.success) return invalidBody(c, result.error.issues);
        }),
        async (c) => {
            const userId = c.var.userId;
            const entry = await booked(c.req.valid("json"), await currenciesOf(userId), c.var.currency);
            const changes = moves({ ...entry, toAccountId: entry.toAccountId ?? null });

            const result = await db.transaction(async (tx) => {
                if (entry.id) {
                    const [existing] = await tx
                        .select()
                        .from(transactions)
                        .where(eq(transactions.id, entry.id))
                        .limit(1);
                    if (existing && existing.userId !== userId) {
                        throw new HTTPException(409, { message: "That id is taken" });
                    }
                    if (existing) return { row: existing, created: false };
                }

                const owned = await tx
                    .select({ id: accounts.id })
                    .from(accounts)
                    .where(and(eq(accounts.userId, userId), inArray(accounts.id, changes.map((change) => change.accountId))));

                if (owned.length !== changes.length) {
                    throw new HTTPException(422, { message: "Unknown account" });
                }

                if (entry.tagIds.length > 0) {
                    const ownedTags = await tx
                        .select({ id: tags.id, kind: tags.kind })
                        .from(tags)
                        .where(and(eq(tags.userId, userId), inArray(tags.id, entry.tagIds)));

                    if (ownedTags.length !== entry.tagIds.length) {
                        throw new HTTPException(422, { message: "Unknown tag" });
                    }
                    if (ownedTags.some((tag) => tag.kind !== entry.kind)) {
                        throw new HTTPException(422, {
                            message: `Only ${entry.kind} tags fit this entry`,
                        });
                    }
                }

                const [inserted] = await tx
                    .insert(transactions)
                    .values({
                        ...(entry.id ? { id: entry.id } : {}),
                        userId,
                        name: entry.name,
                        kind: entry.kind,
                        accountId: entry.accountId,
                        toAccountId: entry.toAccountId ?? null,
                        amount: entry.amount,
                        toAmount: entry.toAmount,
                        originalAmount: entry.original?.amount ?? null,
                        originalCurrency: entry.original?.currency ?? null,
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

                return { row: inserted, created: true };
            });

            const view = await viewFor(userId, c.var.currency);
            return c.json(toTransaction(result.row, entry.tagIds, entry.bookedIn, view), result.created ? 201 : 200);
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
            const userId = c.var.userId;
            const entry = await booked(c.req.valid("json"), await currenciesOf(userId), c.var.currency);
            const wanted = moves({ ...entry, toAccountId: entry.toAccountId ?? null });

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
                        .select({ id: tags.id, kind: tags.kind })
                        .from(tags)
                        .where(and(eq(tags.userId, userId), inArray(tags.id, entry.tagIds)));

                    if (ownedTags.length !== entry.tagIds.length) {
                        throw new HTTPException(422, { message: "Unknown tag" });
                    }
                    if (ownedTags.some((tag) => tag.kind !== entry.kind)) {
                        throw new HTTPException(422, {
                            message: `Only ${entry.kind} tags fit this entry`,
                        });
                    }
                }

                const undo = moves(current);

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
                        toAmount: entry.toAmount,
                        originalAmount: entry.original?.amount ?? null,
                        originalCurrency: entry.original?.currency ?? null,
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

            return c.json(toTransaction(row, entry.tagIds, entry.bookedIn, await viewFor(userId, c.var.currency)));
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

                const changes = moves(gone);

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
