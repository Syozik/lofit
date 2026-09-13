import { euros } from "@lofit/domain";
import { asc, eq } from "drizzle-orm";
import { auth } from "../src/auth/auth";
import { db } from "../src/db/client";
import { accounts, groups, holdings, tags, transactions, transactionTags, users } from "../src/db/schema";
import { env } from "../src/env";

export const TEST_PASSWORD = "test-password";

export type SignedInUser = typeof users.$inferSelect & { cookie: string };

export async function createUser(email = env.devUserEmail): Promise<SignedInUser> {
    const response = await auth.api.signUpEmail({
        body: { email, name: email, password: TEST_PASSWORD },
        asResponse: true,
    });

    if (!response.ok) {
        throw new Error(`Could not sign up ${email}: ${await response.text()}`);
    }

    const cookie = response.headers
        .getSetCookie()
        .map((entry) => entry.split(";")[0])
        .join("; ");

    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!user) throw new Error(`Signing up ${email} left no user behind.`);

    await db.delete(tags).where(eq(tags.userId, user.id));

    return { ...user, cookie };
}

export async function createGroup(userId: string, name = "Cash", position = 0) {
    const [group] = await db.insert(groups).values({ userId, name, position }).returning();
    return group!;
}

export async function firstGroup(userId: string) {
    const [group] = await db
        .select()
        .from(groups)
        .where(eq(groups.userId, userId))
        .orderBy(asc(groups.position))
        .limit(1);
    return group ?? (await createGroup(userId));
}

export async function createAccount(
    userId: string,
    fields: Partial<typeof accounts.$inferInsert> = {},
) {
    const groupId = fields.groupId ?? (await firstGroup(userId)).id;

    const [account] = await db
        .insert(accounts)
        .values({
            userId,
            name: "Checking",
            subtitle: "",
            balance: euros(0),
            provenance: "manual",
            ...fields,
            groupId,
        })
        .returning();
    return account!;
}

export async function createTag(userId: string, name = "Groceries", position = 0) {
    const [tag] = await db.insert(tags).values({ userId, name, position }).returning();
    return tag!;
}

export async function createHolding(
    userId: string,
    fields: Partial<typeof holdings.$inferInsert> = {},
) {
    const accountId = fields.accountId ?? (await createAccount(userId, { name: "DEGIRO" })).id;

    const [holding] = await db
        .insert(holdings)
        .values({
            userId,
            symbol: "VWRL",
            name: "Vanguard FTSE All-World",
            type: "etf",
            quantity: 10,
            price: euros(100),
            cost: euros(1000),
            ...fields,
            accountId,
        })
        .returning();
    return holding!;
}

export async function createTransaction(
    userId: string,
    accountId: string,
    fields: Partial<typeof transactions.$inferInsert> = {},
    tagIds: readonly string[] = [],
) {
    const [transaction] = await db
        .insert(transactions)
        .values({
            userId,
            accountId,
            name: "Albert Heijn",
            kind: "expense",
            amount: euros(-10),
            occurredAt: new Date("2026-07-15T12:00:00Z"),
            ...fields,
        })
        .returning();

    if (tagIds.length > 0) {
        await db.insert(transactionTags).values(
            tagIds.map((tagId, position) => ({
                transactionId: transaction!.id,
                tagId,
                userId,
                position,
            })),
        );
    }

    return transaction!;
}

export async function balanceOf(accountId: string) {
    const [row] = await db
        .select({ balance: accounts.balance })
        .from(accounts)
        .where(eq(accounts.id, accountId));
    return row?.balance;
}
