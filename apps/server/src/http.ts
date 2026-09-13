import type { Context } from "hono";

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
