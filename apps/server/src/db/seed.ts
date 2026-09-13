import {
    FIXTURE_ACCOUNTS,
    FIXTURE_BUDGETS,
    FIXTURE_GROUPS,
    FIXTURE_HOLDINGS,
    FIXTURE_SNAPSHOTS,
    FIXTURE_TAGS,
    FIXTURE_TRANSACTIONS,
} from "@lofit/domain";
import { eq } from "drizzle-orm";
import { auth } from "../auth/auth";
import { env } from "../env";
import { connection, db } from "./client";
import {
    accounts,
    budgets,
    groups,
    holdings,
    snapshots,
    tags,
    transactions,
    transactionTags,
    users,
} from "./schema";

const email = env.devUserEmail;

async function signUpDevUser() {
    await db.delete(users).where(eq(users.email, email));

    const result = await auth.api.signUpEmail({
        body: { email, name: "Dev user", password: env.devUserPassword },
    });

    return result.user.id;
}

async function seed() {
    const userId = await signUpDevUser();

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
                lastSyncedAt: account.lastSyncedAt ? new Date(account.lastSyncedAt) : null,
                change: account.change ?? null,
                details: account.details ?? null,
            })),
        );

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
            FIXTURE_HOLDINGS.map((holding) => ({
                userId: user.id,
                symbol: holding.symbol,
                name: holding.name,
                type: holding.type,
                accountId: accountId(holding.accountId),
                quantity: holding.quantity,
                price: holding.price,
                cost: holding.cost,
                pricedAt: holding.pricedAt ? new Date(holding.pricedAt) : null,
                quote: holding.quote ?? null,
            })),
        );

        const transactionIds = new Map(
            FIXTURE_TRANSACTIONS.map((transaction) => [transaction.id, crypto.randomUUID()]),
        );

        await tx.insert(transactions).values(
            FIXTURE_TRANSACTIONS.map((transaction) => ({
                id: transactionIds.get(transaction.id)!,
                userId: user.id,
                name: transaction.name,
                kind: transaction.kind,
                accountId: accountId(transaction.accountId),
                toAccountId: transaction.toAccountId ? accountId(transaction.toAccountId) : null,
                amount: transaction.amount,
                occurredAt: new Date(transaction.occurredAt),
            })),
        );

        const tagged = FIXTURE_TRANSACTIONS.flatMap((transaction) =>
            transaction.tagIds.map((fixtureTagId, position) => ({
                transactionId: transactionIds.get(transaction.id)!,
                tagId: tagId(fixtureTagId),
                userId: user.id,
                position,
            })),
        );
        if (tagged.length > 0) await tx.insert(transactionTags).values(tagged);

        await tx.insert(budgets).values(
            FIXTURE_BUDGETS.map((budget) => ({
                userId: user.id,
                tagId: tagId(budget.tagId),
                limit: budget.limit,
            })),
        );

        await tx.insert(snapshots).values(
            FIXTURE_SNAPSHOTS.flatMap((snapshot) =>
                snapshot.groups.map((entry) => ({
                    userId: user.id,
                    period: snapshot.period,
                    groupId: groupId(entry.groupId),
                    amount: entry.amount,
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
