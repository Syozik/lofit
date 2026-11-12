import { cents, dueDays, EURO, following, toBase } from "@lofit/domain";
import type { Cents, Currency, QuoteRef } from "@lofit/domain";
import { and, eq, inArray, lte } from "drizzle-orm";
import { db } from "./db/client";
import { recurring, recurringBuys, tags } from "./db/schema";
import { priced, settle } from "./holdings";
import type { PricedBuy } from "./holdings";
import { booked, currenciesOf, record } from "./ledger";
import type { Booked } from "./ledger";
import { perBaseOn, priceHistory } from "./prices/history";

type Row = typeof recurring.$inferSelect;
type BuyRow = typeof recurringBuys.$inferSelect;

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

    const claimed = await db.transaction(async (tx) => {
        const moved = await tx
            .update(recurring)
            .set({ nextDue: following(days.at(-1)!, row.cadence, row.anchor) })
            .where(and(eq(recurring.id, row.id), eq(recurring.nextDue, row.nextDue)))
            .returning({ id: recurring.id });
        if (moved.length === 0) return false;
        for (const entry of entries) await record(tx, row.userId, entry);
        return true;
    });

    return claimed ? days.length : 0;
}

async function priceOn(
    quote: QuoteRef | null,
    day: string,
): Promise<{ price: Cents; currency: string } | undefined> {
    if (!quote) return undefined;
    const history = await priceHistory(quote, day, EURO).catch(() => null);
    const close = history?.points.filter((point) => point.day <= day).at(-1);
    return close && history ? { price: close.price, currency: history.currency } : undefined;
}

async function logBuy(row: BuyRow, through: string): Promise<number> {
    const days = dueDays(row, through);
    if (days.length === 0) return 0;

    const owned = await currenciesOf(row.userId);
    const buys: PricedBuy[] = [];
    let latest = { price: row.price, currency: row.priceCurrency };

    for (const day of days) {
        latest = (await priceOn(row.quote, day)) ?? latest;
        let quantity = row.quantity;
        if (quantity === null) {
            const rate = await perBaseOn(row.currency, latest.currency, day);
            if (!rate) throw new Error(`No ${latest.currency} rate for ${row.currency}`);
            quantity = Math.round((toBase(cents(row.amount!), rate) / latest.price) * 1e6) / 1e6;
        }
        buys.push(
            await priced(
                {
                    symbol: row.symbol,
                    name: row.name,
                    type: row.type,
                    accountId: row.accountId,
                    fromAccountId: row.fromAccountId,
                    quantity,
                    price: latest.price,
                    currency: latest.currency,
                    heldSince: day,
                    quote: row.quote ?? undefined,
                },
                owned,
                day,
            ),
        );
    }

    const claimed = await db.transaction(async (tx) => {
        const moved = await tx
            .update(recurringBuys)
            .set({
                nextDue: following(days.at(-1)!, row.cadence, row.anchor),
                price: latest.price,
                priceCurrency: latest.currency,
            })
            .where(and(eq(recurringBuys.id, row.id), eq(recurringBuys.nextDue, row.nextDue)))
            .returning({ id: recurringBuys.id });
        if (moved.length === 0) return false;
        for (const buy of buys) await settle(tx, row.userId, buy, "recurring");
        return true;
    });

    return claimed ? days.length : 0;
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

    const buys = await db
        .select()
        .from(recurringBuys)
        .where(
            and(
                eq(recurringBuys.paused, false),
                lte(recurringBuys.nextDue, through),
                ...(userId ? [eq(recurringBuys.userId, userId)] : []),
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
    for (const row of buys) {
        try {
            logged += await logBuy(row, through);
        } catch (error) {
            console.error(`Could not log recurring buy ${row.id}`, error);
        }
    }
    return logged;
}
