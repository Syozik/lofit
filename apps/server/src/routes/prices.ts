import { Hono } from "hono";
import type { AuthEnv } from "../auth/session";
import { refreshRates } from "../prices/rates";
import { refreshPrices } from "../prices/refresh";

export const pricesRoute = new Hono<AuthEnv>().post("/refresh", async (c) => {
    await refreshRates();
    return c.json(await refreshPrices(c.var.userId));
});
