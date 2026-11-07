import { Hono } from "hono";
import type { AuthEnv } from "../auth/session";
import { refreshRates } from "../prices/rates";
import { refreshPrices } from "../prices/refresh";
import { spend } from "../quota";

export const pricesRoute = new Hono<AuthEnv>().post("/refresh", async (c) => {
    spend(`prices:${c.var.userId}`, 3, 60_000, "Prices were just refreshed. Try again in a minute.");
    await refreshRates();
    return c.json(await refreshPrices(c.var.userId));
});
