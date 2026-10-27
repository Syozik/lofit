import { netWorthGroups, netWorthItems } from "@lofit/domain";
import { and, eq } from "drizzle-orm";
import { db } from "./db/client";
import { toAccount, toGroup, toHolding } from "./db/mappers";
import { accounts, groups, holdings, snapshots, users } from "./db/schema";

async function totalsFor(userId: string) {
    const [accountRows, holdingRows, groupRows] = await Promise.all([
        db.select().from(accounts).where(eq(accounts.userId, userId)),
        db.select().from(holdings).where(eq(holdings.userId, userId)),
        db.select().from(groups).where(eq(groups.userId, userId)),
    ]);

    const items = netWorthItems(accountRows.map(toAccount), holdingRows.map(toHolding));
    return netWorthGroups(items, groupRows.map(toGroup));
}

export async function recordSnapshots(day = new Date().toISOString().slice(0, 10)): Promise<number> {
    const owners = await db.select({ id: users.id }).from(users);
    let written = 0;

    for (const { id: userId } of owners) {
        const totals = await totalsFor(userId);

        await db.transaction(async (tx) => {
            await tx
                .delete(snapshots)
                .where(and(eq(snapshots.userId, userId), eq(snapshots.day, day)));
            if (totals.length === 0) return;
            await tx.insert(snapshots).values(
                totals.map((entry) => ({ userId, day, groupId: entry.group.id, amount: entry.total })),
            );
        });

        written += totals.length;
    }

    return written;
}
