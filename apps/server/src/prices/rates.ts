import { EURO } from "@lofit/domain";
import { desc, eq } from "drizzle-orm";
import { db } from "../db/client";
import { fxRates } from "../db/schema";
import { fetchEcbRates } from "./ecb";

export type RateLookup = (currency: string) => Promise<number | undefined>;

async function storeLatest(): Promise<void> {
    const published = await fetchEcbRates();
    if (!published) return;

    const rows = [...published.perEuro].map(([currency, perEuro]) => ({
        day: published.day,
        currency,
        perEuro,
    }));

    await db.insert(fxRates).values(rows).onConflictDoNothing();
}

export async function refreshRates(): Promise<number> {
    await storeLatest();
    const rows = await db.select().from(fxRates);
    return rows.length;
}

export async function perEuro(currency: string): Promise<number | undefined> {
    if (currency === EURO) return 1;

    const [known] = await db
        .select()
        .from(fxRates)
        .where(eq(fxRates.currency, currency))
        .orderBy(desc(fxRates.day))
        .limit(1);

    if (known) return known.perEuro;

    await storeLatest();

    const [fetched] = await db
        .select()
        .from(fxRates)
        .where(eq(fxRates.currency, currency))
        .orderBy(desc(fxRates.day))
        .limit(1);

    return fetched?.perEuro;
}
