import { asc, eq } from "drizzle-orm";
import { Hono } from "hono";
import type { AuthEnv } from "../auth/session";
import { db } from "../db/client";
import { toSnapshots } from "../db/mappers";
import { snapshots } from "../db/schema";

export const snapshotsRoute = new Hono<AuthEnv>().get("/", async (c) => {
    const rows = await db
        .select()
        .from(snapshots)
        .where(eq(snapshots.userId, c.var.userId))
        .orderBy(asc(snapshots.period));

    return c.json(toSnapshots(rows));
});
