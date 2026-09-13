import { zValidator } from "@hono/zod-validator";
import { restated } from "@lofit/domain";
import { accountBalanceSchema, newAccountSchema } from "@lofit/domain/schemas";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { AuthEnv } from "../auth/session";
import { db } from "../db/client";
import { toAccount } from "../db/mappers";
import { accounts, groups } from "../db/schema";
import { invalidBody } from "../http";

export const accountsRoute = new Hono<AuthEnv>()
    .get("/", async (c) => {
        const rows = await db
            .select({ account: accounts })
            .from(accounts)
            .innerJoin(groups, eq(groups.id, accounts.groupId))
            .where(eq(accounts.userId, c.var.userId))
            .orderBy(asc(groups.position), asc(accounts.createdAt), asc(accounts.name));

        return c.json(rows.map((row) => toAccount(row.account)));
    })
    .post(
        "/",
        zValidator("json", newAccountSchema, (result, c) => {
            if (!result.success) return invalidBody(c, result.error.issues);
        }),
        async (c) => {
            const draft = c.req.valid("json");
            const userId = c.var.userId;

            const row = await db.transaction(async (tx) => {
                const [group] = await tx
                    .select({ id: groups.id })
                    .from(groups)
                    .where(and(eq(groups.id, draft.groupId), eq(groups.userId, userId)))
                    .limit(1);

                if (!group) throw new HTTPException(422, { message: "Unknown group" });

                const [created] = await tx
                    .insert(accounts)
                    .values({
                        userId,
                        name: draft.name,
                        subtitle: draft.subtitle,
                        groupId: draft.groupId,
                        balance: draft.balance,
                        provenance: "manual",
                        statedAt: new Date(),
                    })
                    .returning();

                return created!;
            });

            return c.json(toAccount(row), 201);
        },
    )
    .patch(
        "/:id",
        zValidator("param", z.object({ id: z.uuid() }), (result) => {
            if (!result.success) throw new HTTPException(404, { message: "No such account" });
        }),
        zValidator("json", accountBalanceSchema, (result, c) => {
            if (!result.success) return invalidBody(c, result.error.issues);
        }),
        async (c) => {
            const id = c.req.param("id");
            const { balance } = c.req.valid("json");
            const userId = c.var.userId;

            const row = await db.transaction(async (tx) => {
                const [current] = await tx
                    .select()
                    .from(accounts)
                    .where(and(eq(accounts.id, id), eq(accounts.userId, userId)))
                    .limit(1);

                if (!current) throw new HTTPException(404, { message: "No such account" });

                const now = new Date();
                const since = current.statedAt ?? current.lastSyncedAt ?? current.createdAt;
                const next = restated(
                    toAccount(current),
                    balance,
                    now.toISOString(),
                    since.toISOString(),
                );

                const [updated] = await tx
                    .update(accounts)
                    .set({ balance: next.balance, statedAt: now, change: next.change })
                    .where(and(eq(accounts.id, id), eq(accounts.userId, userId)))
                    .returning();

                return updated!;
            });

            return c.json(toAccount(row));
        },
    );
