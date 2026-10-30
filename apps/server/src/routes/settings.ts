import { zValidator } from "@hono/zod-validator";
import { settingsSchema } from "@lofit/domain/schemas";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import type { AuthEnv } from "../auth/session";
import { db } from "../db/client";
import { users } from "../db/schema";
import { invalidBody } from "../http";

export const settingsRoute = new Hono<AuthEnv>()
    .get("/", (c) => c.json({ currency: c.var.currency }))
    .patch(
        "/",
        zValidator("json", settingsSchema, (result, c) => {
            if (!result.success) return invalidBody(c, result.error.issues);
        }),
        async (c) => {
            const { currency } = c.req.valid("json");
            await db.update(users).set({ currency, updatedAt: new Date() }).where(eq(users.id, c.var.userId));
            return c.json({ currency });
        },
    );
