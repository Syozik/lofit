import { balanceChanges, negateCents, toBase } from "@lofit/domain";
import type { Cents } from "@lofit/domain";
import type { newTransactionSchema } from "@lofit/domain/schemas";
import { and, eq, inArray, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import type { z } from "zod";
import { db } from "./db/client";
import { accounts, tags, transactions, transactionTags } from "./db/schema";
import { perBaseOn } from "./prices/history";

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type Entry = z.output<typeof newTransactionSchema>;

export type Booked = Omit<Entry, "toAmount"> & {
    toAmount: Cents | null;
    original: { amount: Cents; currency: string } | null;
    bookedIn: string;
};

export async function currenciesOf(userId: string): Promise<Map<string, string>> {
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

export async function booked(entry: Entry, owned: Map<string, string>, display: string): Promise<Booked> {
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

export function moves(row: { accountId: string; toAccountId: string | null; amount: Cents; toAmount: Cents | null }) {
    return balanceChanges({
        accountId: row.accountId,
        toAccountId: row.toAccountId ?? undefined,
        amount: row.amount,
        toAmount: row.toAmount ?? undefined,
    });
}

export async function checkTags(tx: Tx, userId: string, entry: Pick<Entry, "tagIds" | "kind">): Promise<void> {
    if (entry.tagIds.length === 0) return;

    const ownedTags = await tx
        .select({ id: tags.id, kind: tags.kind })
        .from(tags)
        .where(and(eq(tags.userId, userId), inArray(tags.id, entry.tagIds)));

    if (ownedTags.length !== entry.tagIds.length) {
        throw new HTTPException(422, { message: "Unknown tag" });
    }
    if (ownedTags.some((tag) => tag.kind !== entry.kind)) {
        throw new HTTPException(422, { message: `Only ${entry.kind} tags fit this entry` });
    }
}

export async function record(tx: Tx, userId: string, entry: Booked) {
    await checkTags(tx, userId, entry);

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
            entry.tagIds.map((tagId, position) => ({ transactionId: inserted.id, tagId, userId, position })),
        );
    }

    for (const change of moves(inserted)) {
        await tx
            .update(accounts)
            .set({ balance: sql`${accounts.balance} + ${change.delta}` })
            .where(and(eq(accounts.id, change.accountId), eq(accounts.userId, userId)));
    }

    return inserted;
}
