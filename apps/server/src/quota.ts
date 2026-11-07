import { HTTPException } from "hono/http-exception";

const used = new Map<string, { count: number; resetAt: number }>();

export function spend(key: string, limit: number, windowMs: number, message: string): void {
    const now = Date.now();
    const entry = used.get(key);
    if (!entry || entry.resetAt <= now) {
        used.set(key, { count: 1, resetAt: now + windowMs });
    } else if (entry.count >= limit) {
        throw new HTTPException(429, { message });
    } else {
        entry.count += 1;
    }

    if (used.size > 10_000) {
        for (const [stale, value] of used) if (value.resetAt <= now) used.delete(stale);
    }
}
