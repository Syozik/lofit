import { CURRENCIES } from "@lofit/domain";
import { Hono } from "hono";
import type { AuthEnv } from "../auth/session";
import { perEuro } from "../prices/rates";

export const ratesRoute = new Hono<AuthEnv>().get("/", async (c) => {
    const rates = await Promise.all(CURRENCIES.map(async (currency) => [currency, await perEuro(currency)] as const));
    return c.json(Object.fromEntries(rates.filter(([, rate]) => rate !== undefined)) as Record<string, number>);
});
