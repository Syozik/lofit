import { dueDays, following } from "@lofit/domain";
import type { Currency } from "@lofit/domain";
import { and, eq, inArray, lte } from "drizzle-orm";
import { db } from "./db/client";
import { recurring, tags } from "./db/schema";
import { booked, currenciesOf, record } from "./ledger";
import type { Booked } from "./ledger";

type Row = typeof recurring.$inferSelect;

function today(): string {
    return new Date().toISOString().slice(0, 10);
}

async function logRow(row: Row, through: string): Promise<number> {
    const days = dueDays(row, through);
    if (days.length === 0) return 0;

    const [owned, known] = await Promise.all([
        currenciesOf(row.userId),
        row.tagIds.length > 0
            ? db.select({ id: tags.id }).from(tags).where(and(eq(tags.userId, row.userId), inArray(tags.id, row.tagIds)))
            : Promise.resolve([]),
    ]);
    const tagIds = row.tagIds.filter((id) => known.some((tag) => tag.id === id));

    const entries: Booked[] = [];
    for (const day of days) {
        entries.push(
            await booked(
                {
                    name: row.name,
                    kind: row.kind,
                    tagIds,
                    accountId: row.accountId,
                    ...(row.toAccountId ? { toAccountId: row.toAccountId } : {}),
                    amount: row.amount,
                    ...(row.toAmount !== null ? { toAmount: row.toAmount } : {}),
                    currency: row.currency as Currency,
                    occurredAt: `${day}T12:00:00.000Z`,
                },
                owned,
                row.currency,
            ),
        );
    }

    await db.transaction(async (tx) => {
        for (const entry of entries) await record(tx, row.userId, entry);
        await tx
            .update(recurring)
            .set({ nextDue: following(days.at(-1)!, row.cadence, row.anchor) })
            .where(eq(recurring.id, row.id));
    });

    return days.length;
}

export async function logDue(userId?: string, through = today()): Promise<number> {
    const due = await db
        .select()
        .from(recurring)
        .where(
            and(
                eq(recurring.paused, false),
                lte(recurring.nextDue, through),
                ...(userId ? [eq(recurring.userId, userId)] : []),
            ),
        );

    let logged = 0;
    for (const row of due) {
        try {
            logged += await logRow(row, through);
        } catch (error) {
            console.error(`Could not log recurring ${row.id}`, error);
        }
    }
    return logged;
}
