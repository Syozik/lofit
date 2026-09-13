import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 300;

const hits = new Map<string, { count: number; resetAt: number }>();

export const rateLimit = createMiddleware(async (c, next) => {
    const caller = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    const now = Date.now();
    const seen = hits.get(caller);

    if (!seen || seen.resetAt <= now) {
        hits.set(caller, { count: 1, resetAt: now + WINDOW_MS });
    } else {
        seen.count += 1;
        if (seen.count > MAX_REQUESTS) throw new HTTPException(429, { message: "Too many requests" });
    }

    if (hits.size > 10_000) {
        for (const [key, entry] of hits) if (entry.resetAt <= now) hits.delete(key);
    }

    await next();
});
