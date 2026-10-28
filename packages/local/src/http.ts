import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

type Issue = { path: readonly PropertyKey[]; message: string };

export function invalidBody(c: Context, issues: readonly Issue[]) {
    return c.json(
        {
            error: "Invalid request",
            issues: issues.map((issue) => ({
                path: issue.path.map(String).join("."),
                message: issue.message,
            })),
        },
        400,
    );
}

export async function readJson<T extends z.ZodType>(c: Context, schema: T) {
    let body: unknown;
    try {
        body = await c.req.json();
    } catch {
        throw new HTTPException(400, { message: "Malformed JSON in request body" });
    }
    return schema.safeParse(body);
}

const uuid = z.uuid();

export function idParam(c: Context, name: string, missing: string): string {
    const value = c.req.param(name) ?? "";
    if (!uuid.safeParse(value).success) throw new HTTPException(404, { message: missing });
    return value;
}

export function needsAccount(message: string) {
    return (c: Context) => c.json({ error: message }, 501);
}
