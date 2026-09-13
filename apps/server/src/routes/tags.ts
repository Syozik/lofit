import { zValidator } from "@hono/zod-validator";
import { newTagSchema } from "@lofit/domain/schemas";
import { and, asc, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import type { AuthEnv } from "../auth/session";
import { db } from "../db/client";
import { toTag } from "../db/mappers";
import { tags } from "../db/schema";
import { invalidBody } from "../http";

export const tagsRoute = new Hono<AuthEnv>()
    .get("/", async (c) => {
        const rows = await db
            .select()
            .from(tags)
            .where(eq(tags.userId, c.var.userId))
            .orderBy(asc(tags.position));

        return c.json(rows.map(toTag));
    })
    .post(
        "/",
        zValidator("json", newTagSchema, (result, c) => {
            if (!result.success) return invalidBody(c, result.error.issues);
        }),
        async (c) => {
            const { name } = c.req.valid("json");
            const userId = c.var.userId;

            const result = await db.transaction(async (tx) => {
                const [existing] = await tx
                    .select()
                    .from(tags)
                    .where(and(eq(tags.userId, userId), sql`lower(${tags.name}) = lower(${name})`))
                    .limit(1);
                if (existing) return { tag: existing, created: false };

                const [end] = await tx
                    .select({ next: sql<number>`coalesce(max(${tags.position}) + 1, 0)::int` })
                    .from(tags)
                    .where(eq(tags.userId, userId));

                const [row] = await tx
                    .insert(tags)
                    .values({ userId, name, position: end?.next ?? 0 })
                    .returning();
                if (!row) throw new Error("Creating a tag returned no row.");

                return { tag: row, created: true };
            });

            return c.json(toTag(result.tag), result.created ? 201 : 200);
        },
    );
