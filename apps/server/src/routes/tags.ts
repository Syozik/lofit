import { zValidator } from "@hono/zod-validator";
import { newTagSchema } from "@lofit/domain/schemas";
import { and, asc, eq, ne, sql } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
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
            const { id, name } = c.req.valid("json");
            const userId = c.var.userId;

            const result = await db.transaction(async (tx) => {
                if (id) {
                    const [same] = await tx
                        .select()
                        .from(tags)
                        .where(and(eq(tags.id, id), eq(tags.userId, userId)))
                        .limit(1);
                    if (same) return { tag: same, created: false };
                }

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
                    .values({ ...(id ? { id } : {}), userId, name, position: end?.next ?? 0 })
                    .returning();
                if (!row) throw new Error("Creating a tag returned no row.");

                return { tag: row, created: true };
            });

            return c.json(toTag(result.tag), result.created ? 201 : 200);
        },
    )
    .patch(
        "/:id",
        zValidator("param", z.object({ id: z.uuid() }), (result) => {
            if (!result.success) throw new HTTPException(404, { message: "No such tag" });
        }),
        zValidator("json", newTagSchema, (result, c) => {
            if (!result.success) return invalidBody(c, result.error.issues);
        }),
        async (c) => {
            const id = c.req.param("id");
            const { name } = c.req.valid("json");
            const userId = c.var.userId;

            const row = await db.transaction(async (tx) => {
                const [clash] = await tx
                    .select({ id: tags.id })
                    .from(tags)
                    .where(
                        and(
                            eq(tags.userId, userId),
                            ne(tags.id, id),
                            sql`lower(${tags.name}) = lower(${name})`,
                        ),
                    )
                    .limit(1);
                if (clash) throw new HTTPException(409, { message: `A tag named ${name} already exists` });

                const [renamed] = await tx
                    .update(tags)
                    .set({ name })
                    .where(and(eq(tags.id, id), eq(tags.userId, userId)))
                    .returning();
                if (!renamed) throw new HTTPException(404, { message: "No such tag" });

                return renamed;
            });

            return c.json(toTag(row));
        },
    );
