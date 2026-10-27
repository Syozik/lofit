import { zValidator } from "@hono/zod-validator";
import type { ImportDraft } from "@lofit/domain";
import { screenshotImportSchema } from "@lofit/domain/schemas";
import { asc, eq } from "drizzle-orm";
import { Hono } from "hono";
import type { AuthEnv } from "../auth/session";
import { db } from "../db/client";
import { accounts, tags, transactions } from "../db/schema";
import { invalidBody } from "../http";
import { extractDrafts } from "../imports/extract";

function dayOf(instant: Date): string {
    return instant.toISOString().slice(0, 10);
}

function withoutDuplicates(
    drafts: readonly ImportDraft[],
    logged: ReadonlySet<string>,
): ImportDraft[] {
    const seen = new Set(logged);
    return drafts.filter((draft) => {
        const key = `${draft.day}|${draft.amount}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

export const importsRoute = new Hono<AuthEnv>().post(
    "/screenshot",
    zValidator("json", screenshotImportSchema, (result, c) => {
        if (!result.success) return invalidBody(c, result.error.issues);
    }),
    async (c) => {
        const { image, mediaType } = c.req.valid("json");
        const userId = c.var.userId;

        const [accountRows, tagRows, existing] = await Promise.all([
            db
                .select({ id: accounts.id, name: accounts.name })
                .from(accounts)
                .where(eq(accounts.userId, userId)),
            db
                .select({ id: tags.id, name: tags.name })
                .from(tags)
                .where(eq(tags.userId, userId))
                .orderBy(asc(tags.position)),
            db
                .select({ amount: transactions.amount, occurredAt: transactions.occurredAt })
                .from(transactions)
                .where(eq(transactions.userId, userId)),
        ]);

        const drafts = await extractDrafts({
            image,
            mediaType,
            today: dayOf(new Date()),
            accounts: accountRows,
            tags: tagRows,
        });

        const logged = new Set(existing.map((row) => `${dayOf(row.occurredAt)}|${row.amount}`));
        const fresh = withoutDuplicates(drafts, logged);

        return c.json({ drafts: fresh, skipped: drafts.length - fresh.length });
    },
);
