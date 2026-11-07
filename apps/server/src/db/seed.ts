import {
    FIXTURE_ACCOUNTS,
    FIXTURE_BUDGETS,
    FIXTURE_GROUPS,
    FIXTURE_HOLDINGS,
    FIXTURE_SNAPSHOTS,
    FIXTURE_TAGS,
    FIXTURE_TRANSACTIONS,
    euros,
    following,
    quoteKey,
} from "@lofit/domain";
import type { Cadence, Cents, Transaction } from "@lofit/domain";
import { eq } from "drizzle-orm";
import { auth } from "../auth/auth";
import { env } from "../env";
import { fetchLiveQuotes } from "../prices/live";
import type { Quote } from "../prices/refresh";
import { perEuro } from "../prices/rates";
import { connection, db } from "./client";
import {
    accounts,
    budgets,
    groups,
    holdings,
    recurring,
    recurringBuys,
    snapshots,
    tags,
    transactions,
    transactionTags,
    users,
} from "./schema";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const databaseHost = new URL(env.databaseUrl).hostname;
if (env.production || !LOCAL_HOSTS.has(databaseHost)) {
    throw new Error(`The dev seed only runs against a local database outside production, not ${databaseHost}.`);
}

const email = env.devUserEmail;

const DAY_MS = 86_400_000;
const now = new Date();
const today = now.toISOString().slice(0, 10);
const FIXTURE_LAST_DAY = "2026-07-31";
const MONTHS_OF_ACTIVITY = 4;
const STEADY = new Set(["tx-huur", "tx-duo", "tx-salaris", "tx-degiro", "tx-spotify", "tx-netflix", "tx-icloud", "tx-strava"]);

function shiftDay(day: string, days: number): string {
    return new Date(Date.parse(day) + days * DAY_MS).toISOString().slice(0, 10);
}

function recentActivity(): (Transaction & { sourceId: string })[] {
    return Array.from({ length: MONTHS_OF_ACTIVITY }, (_, back) => back).flatMap((back) => {
        const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1));
        const lastDate = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0)).getUTCDate();
        return FIXTURE_TRANSACTIONS.flatMap((transaction) => {
            const source = new Date(transaction.occurredAt);
            const at = new Date(month);
            at.setUTCDate(Math.min(source.getUTCDate(), lastDate));
            at.setUTCHours(source.getUTCHours(), source.getUTCMinutes());
            if (at > now) return [];
            const factor = STEADY.has(transaction.id) ? 1 : 0.8 + ((back * 7 + source.getUTCDate()) % 9) * 0.05;
            return [{
                ...transaction,
                sourceId: transaction.id,
                amount: Math.round(transaction.amount * factor) as Transaction["amount"],
                occurredAt: at.toISOString(),
            }];
        });
    });
}

function nextOn(date: number, cadence: Cadence = "monthly"): { anchor: string; nextDue: string } {
    const anchor = `${today.slice(0, 8)}${String(date).padStart(2, "0")}`;
    return { anchor, nextDue: anchor > today ? anchor : following(anchor, cadence, anchor) };
}

const WISE_USD = euros(2400);

async function liveQuotes(): Promise<Map<string, Quote>> {
    const refs = FIXTURE_HOLDINGS.flatMap((holding) => (holding.quote ? [holding.quote] : []));
    try {
        return await fetchLiveQuotes(refs);
    } catch (error) {
        console.warn("Seeding fixture prices, live quotes failed:", error);
        return new Map();
    }
}

async function usdPerEuro(): Promise<number | undefined> {
    try {
        return await perEuro("USD");
    } catch {
        return undefined;
    }
}

async function signUpDevUser() {
    await db.delete(users).where(eq(users.email, email));

    const result = await auth.api.signUpEmail({
        body: { email, name: "Dev user", password: env.devUserPassword },
    });

    return result.user.id;
}

async function seed() {
    const userId = await signUpDevUser();
    const quotes = await liveQuotes();
    const usdRate = await usdPerEuro();

    const priced = FIXTURE_HOLDINGS.map((holding) => {
        const quote = holding.quote ? quotes.get(quoteKey(holding.quote)) : undefined;
        return { holding, quote, scale: quote ? quote.price / holding.price : 1 };
    });
    const fixtureInvested = priced.reduce((sum, { holding }) => sum + holding.quantity * holding.price, 0);
    const liveInvested = priced.reduce((sum, { holding, scale }) => sum + holding.quantity * holding.price * scale, 0);
    const investScale = fixtureInvested > 0 ? liveInvested / fixtureInvested : 1;
    const wiseInEuro = usdRate ? Math.round(WISE_USD / usdRate) : 0;

    await db.transaction(async (tx) => {
        const user = { id: userId };

        const madeAtSignUp = await tx
            .select({ id: groups.id, name: groups.name })
            .from(groups)
            .where(eq(groups.userId, user.id));
        const groupByName = new Map(madeAtSignUp.map((group) => [group.name, group.id]));

        const missing = FIXTURE_GROUPS.filter((group) => !groupByName.has(group.name));
        if (missing.length > 0) {
            const added = await tx
                .insert(groups)
                .values(
                    missing.map((group) => ({
                        userId: user.id,
                        name: group.name,
                        position: group.position,
                        invests: group.invests,
                    })),
                )
                .returning({ id: groups.id, name: groups.name });
            for (const group of added) groupByName.set(group.name, group.id);
        }

        const groupId = (fixtureId: string) => {
            const fixture = FIXTURE_GROUPS.find((group) => group.id === fixtureId);
            const id = fixture ? groupByName.get(fixture.name) : undefined;
            if (!id) throw new Error(`A fixture references unknown group "${fixtureId}".`);
            return id;
        };

        const accountIds = new Map(FIXTURE_ACCOUNTS.map((account) => [account.id, crypto.randomUUID()]));
        const accountId = (fixtureId: string) => {
            const id = accountIds.get(fixtureId);
            if (!id) throw new Error(`A fixture references unknown account "${fixtureId}".`);
            return id;
        };

        await tx.insert(accounts).values(
            FIXTURE_ACCOUNTS.map((account) => ({
                id: accountId(account.id),
                userId: user.id,
                name: account.name,
                subtitle: account.subtitle,
                groupId: groupId(account.groupId),
                balance: account.balance,
                provenance: account.provenance,
                lastSyncedAt: account.lastSyncedAt ? new Date(now.getTime() - 3 * 3_600_000) : null,
                change: account.change ?? null,
                details: account.details ?? null,
                statedAt: account.provenance === "manual" && account.balance !== 0 ? new Date(now.getTime() - 2 * DAY_MS) : null,
            })),
        );

        if (usdRate) {
            await tx.insert(accounts).values({
                userId: user.id,
                name: "Wise",
                subtitle: "USD balance · freelance",
                groupId: groupId("group-cash"),
                balance: WISE_USD,
                currency: "USD",
                provenance: "manual",
                statedAt: new Date(now.getTime() - 5 * DAY_MS),
            });
        }

        const created = await tx
            .select({ id: tags.id, name: tags.name })
            .from(tags)
            .where(eq(tags.userId, user.id));
        const byName = new Map(created.map((tag) => [tag.name, tag.id]));
        const tagIds = new Map(
            FIXTURE_TAGS.map((tag) => [tag.id, byName.get(tag.name)] as const),
        );
        const tagId = (fixtureId: string) => {
            const id = tagIds.get(fixtureId);
            if (!id) throw new Error(`Sign-up did not create the tag "${fixtureId}".`);
            return id;
        };

        await tx.insert(holdings).values(
            priced.map(({ holding, quote, scale }) => ({
                userId: user.id,
                symbol: holding.symbol,
                name: holding.name,
                type: holding.type,
                accountId: accountId(holding.accountId),
                quantity: holding.quantity,
                price: quote?.price ?? holding.price,
                nativePrice: quote?.nativePrice ?? holding.nativePrice,
                currency: quote?.currency ?? holding.currency,
                cost: Math.round(holding.cost * scale) as Cents,
                heldSince: holding.heldSince,
                pricedAt: holding.pricedAt ? now : null,
                quote: holding.quote ?? null,
            })),
        );

        const activity = recentActivity().map((transaction) => ({ ...transaction, id: crypto.randomUUID() }));

        await tx.insert(transactions).values(
            activity.map((transaction) => ({
                id: transaction.id,
                userId: user.id,
                name: transaction.name,
                kind: transaction.kind,
                accountId: accountId(transaction.accountId),
                toAccountId: transaction.toAccountId ? accountId(transaction.toAccountId) : null,
                amount: transaction.amount,
                occurredAt: new Date(transaction.occurredAt),
            })),
        );

        const tagged = activity.flatMap((transaction) =>
            transaction.tagIds.map((fixtureTagId, position) => ({
                transactionId: transaction.id,
                tagId: tagId(fixtureTagId),
                userId: user.id,
                position,
            })),
        );
        if (tagged.length > 0) await tx.insert(transactionTags).values(tagged);

        const repeating = [
            { name: "Huur — Kwadrant", kind: "expense", tag: "tag-housing", account: "ing", amount: euros(-1375), day: 1 },
            { name: "Spotify", kind: "expense", tag: "tag-subscriptions", account: "rev", amount: euros(-11.99), day: 20 },
            { name: "Salaris — Mistlab BV", kind: "income", tag: "tag-salary", account: "ing", amount: euros(4150), day: 25 },
        ] as const;
        await tx.insert(recurring).values([
            ...repeating.map((entry) => ({
                userId: user.id,
                name: entry.name,
                kind: entry.kind,
                tagIds: [tagId(entry.tag)],
                accountId: accountId(entry.account),
                amount: entry.amount,
                currency: "EUR",
                cadence: "monthly" as const,
                ...nextOn(entry.day),
            })),
            {
                userId: user.id,
                name: "Studieschuld DUO",
                kind: "transfer" as const,
                accountId: accountId("ing"),
                toAccountId: accountId("loan"),
                amount: euros(-145),
                currency: "EUR",
                cadence: "monthly" as const,
                ...nextOn(1),
            },
        ]);

        const vwrl = FIXTURE_HOLDINGS.find((holding) => holding.id === "vwrl")!;
        const btc = FIXTURE_HOLDINGS.find((holding) => holding.id === "btc")!;
        await tx.insert(recurringBuys).values([
            {
                userId: user.id,
                symbol: vwrl.symbol,
                name: vwrl.name,
                type: vwrl.type,
                quote: vwrl.quote ?? null,
                accountId: accountId("degiro"),
                fromAccountId: accountId("ing"),
                amount: euros(500),
                currency: "EUR",
                price: vwrl.price,
                priceCurrency: "EUR",
                cadence: "monthly" as const,
                ...nextOn(26),
            },
            {
                userId: user.id,
                symbol: btc.symbol,
                name: btc.name,
                type: btc.type,
                quote: btc.quote ?? null,
                accountId: accountId("kraken"),
                fromAccountId: accountId("rev"),
                amount: euros(25),
                currency: "EUR",
                price: btc.price,
                priceCurrency: "EUR",
                cadence: "weekly" as const,
                ...nextOn(Number(today.slice(8)), "weekly"),
            },
        ]);

        await tx.insert(budgets).values(
            FIXTURE_BUDGETS.map((budget) => ({
                userId: user.id,
                tagId: tagId(budget.tagId),
                limit: budget.limit,
            })),
        );

        const snapshotAmount = (fixtureGroupId: string, amount: Cents): Cents => {
            if (fixtureGroupId === "group-investments") return Math.round(amount * investScale) as Cents;
            if (fixtureGroupId === "group-cash") return (amount + wiseInEuro) as Cents;
            return amount;
        };
        const snapshotShift = Math.round((Date.parse(today) - DAY_MS - Date.parse(FIXTURE_LAST_DAY)) / DAY_MS);
        await tx.insert(snapshots).values(
            FIXTURE_SNAPSHOTS.flatMap((snapshot) =>
                snapshot.groups.map((entry) => ({
                    userId: user.id,
                    day: shiftDay(snapshot.day, snapshotShift),
                    groupId: groupId(entry.groupId),
                    amount: snapshotAmount(entry.groupId, entry.amount),
                })),
            ),
        );
    });
}

try {
    await seed();

    const [summary] = await connection`
        select
            (select count(*) from accounts a where a.user_id = u.id)::int as accounts,
            (select count(*) from holdings h where h.user_id = u.id)::int as holdings,
            (select count(*) from transactions t where t.user_id = u.id)::int as transactions,
            (select count(*) from snapshots s where s.user_id = u.id)::int as snapshots,
            (select count(*) from tags t where t.user_id = u.id)::int as tags,
            (select count(*) from transaction_tags tt where tt.user_id = u.id)::int as tagged,
            (select coalesce(sum(a.balance), 0) from accounts a where a.user_id = u.id)
                + (select coalesce(sum(round(h.quantity * h.price)), 0) from holdings h where h.user_id = u.id)
                as net_worth_cents
        from users u
        where u.email = ${email}
    `;
    console.log(`Seeded ${email}:`, summary);
} finally {
    await connection.end();
}
