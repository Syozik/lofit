import type { Context } from "hono";
import { env } from "../env";

const MAX_FAILURES = 5;
const MAX_FAILURES_PER_EMAIL = 50;
const WINDOW_MS = 15 * 60_000;
const LOCK_MS = 15 * 60_000;

type Attempts = { failures: number; firstAt: number; lockedUntil: number };

const records = new Map<string, Attempts>();

function lockedFor(record: Attempts | undefined, now: number): number {
    return record && record.lockedUntil > now ? record.lockedUntil - now : 0;
}

function fail(key: string, limit: number, now: number) {
    const record = records.get(key);
    const current = record && record.firstAt + WINDOW_MS > now ? record : { failures: 0, firstAt: now, lockedUntil: 0 };
    current.failures += 1;
    if (current.failures >= limit) current.lockedUntil = now + LOCK_MS;
    records.set(key, current);
}

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
    if (!c.req.header("content-type")?.toLowerCase().startsWith("application/json")) {
        return c.json({ message: "Send the sign-in as JSON." }, 415);
    }

    const email = await emailOf(c.req.raw);
    if (!email) return c.json({ message: "Enter your email." }, 400);

    const caller = c.req.header(env.clientIpHeader)?.trim() || "local";
    const pair = `${email}|${caller}`;
    const now = Date.now();
    const wait = Math.max(lockedFor(records.get(pair), now), lockedFor(records.get(email), now));
    if (wait > 0) {
        const minutes = Math.ceil(wait / 60_000);
        return c.json(
            { message: `Too many failed sign-ins. Try again in ${minutes} min.` },
            429,
            { "Retry-After": String(Math.ceil(wait / 1000)) },
        );
    }

    const response = await signIn(c.req.raw);

    if (response.ok) {
        records.delete(pair);
    } else if (response.status === 401) {
        fail(pair, MAX_FAILURES, now);
        fail(email, MAX_FAILURES_PER_EMAIL, now);
        sweep(now);
    }

    return response;
}
