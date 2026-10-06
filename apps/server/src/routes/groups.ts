import { zValidator } from "@hono/zod-validator";
import { newGroupSchema } from "@lofit/domain/schemas";
import { and, asc, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import type { AuthEnv } from "../auth/session";
import { db } from "../db/client";
import { toGroup } from "../db/mappers";
import { groups } from "../db/schema";
import { invalidBody } from "../http";

export const groupsRoute = new Hono<AuthEnv>()
    .get("/", async (c) => {
        const rows = await db
            .select()
            .from(groups)
            .where(eq(groups.userId, c.var.userId))
            .orderBy(asc(groups.position));

        return c.json(rows.map(toGroup));
    })
    .post(
        "/",
        zValidator("json", newGroupSchema, (result, c) => {
            if (!result.success) return invalidBody(c, result.error.issues);
        }),
        async (c) => {
            const { id, name } = c.req.valid("json");
            const userId = c.var.userId;

            const result = await db.transaction(async (tx) => {
                if (id) {
                    const [same] = await tx
                        .select()
                        .from(groups)
                        .where(and(eq(groups.id, id), eq(groups.userId, userId)))
                        .limit(1);
                    if (same) return { group: same, created: false };
                }

                const [existing] = await tx
                    .select()
                    .from(groups)
                    .where(
                        and(eq(groups.userId, userId), sql`lower(${groups.name}) = lower(${name})`),
                    )
                    .limit(1);
                if (existing) return { group: existing, created: false };

                const [end] = await tx
                    .select({ next: sql<number>`coalesce(max(${groups.position}) + 1, 0)::int` })
                    .from(groups)
                    .where(eq(groups.userId, userId));

                const [row] = await tx
                    .insert(groups)
                    .values({ ...(id ? { id } : {}), userId, name, position: end?.next ?? 0 })
                    .returning();
                if (!row) throw new Error("Creating a group returned no row.");

                return { group: row, created: true };
            });

            return c.json(toGroup(result.group), result.created ? 201 : 200);
        },
    );
