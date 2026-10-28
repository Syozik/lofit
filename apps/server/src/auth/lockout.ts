import type { Context } from "hono";

const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60_000;
const LOCK_MS = 15 * 60_000;

type Attempts = { failures: number; firstAt: number; lockedUntil: number };

const records = new Map<string, Attempts>();

async function emailOf(request: Request): Promise<string | undefined> {
    try {
        const body = (await request.clone().json()) as { email?: unknown };
        return typeof body.email === "string" ? body.email.trim().toLowerCase() : undefined;
    } catch {
        return undefined;
    }
}

function sweep(now: number) {
    if (records.size < 10_000) return;
    for (const [email, record] of records) {
        if (record.lockedUntil <= now && record.firstAt + WINDOW_MS <= now) records.delete(email);
    }
}

export async function guardSignIn(c: Context, signIn: (request: Request) => Promise<Response>) {
    const email = await emailOf(c.req.raw);
    if (!email) return signIn(c.req.raw);

    const now = Date.now();
    const record = records.get(email);
    if (record && record.lockedUntil > now) {
        const minutes = Math.ceil((record.lockedUntil - now) / 60_000);
        return c.json(
            { message: `Too many failed sign-ins. Try again in ${minutes} min.` },
            429,
            { "Retry-After": String(Math.ceil((record.lockedUntil - now) / 1000)) },
        );
    }

    const response = await signIn(c.req.raw);

    if (response.ok) {
        records.delete(email);
    } else if (response.status === 401) {
        const current = record && record.firstAt + WINDOW_MS > now ? record : { failures: 0, firstAt: now, lockedUntil: 0 };
        current.failures += 1;
        if (current.failures >= MAX_FAILURES) current.lockedUntil = now + LOCK_MS;
        records.set(email, current);
        sweep(now);
    }

    return response;
}
