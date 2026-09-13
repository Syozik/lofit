import { serve } from "@hono/node-server";
import { env } from "./env";
import { connection } from "./db/client";
import { refreshRates } from "./prices/rates";
import { refreshPrices } from "./prices/refresh";
import { server } from "./server";

const listening = serve({ fetch: server.fetch, port: env.port }, (info) => {
    console.log(`lofit listening on http://localhost:${info.port}`);
});

const shutdown = () => {
    listening.close();
    void connection.end();
};

process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);

if (env.priceRefreshMinutes > 0) {
    const refresh = () => {
        refreshRates()
            .then(() => refreshPrices())
            .then((report) => console.log("prices refreshed", report))
            .catch((error: unknown) => console.error("price refresh failed", error));
    };

    refresh();
    setInterval(refresh, env.priceRefreshMinutes * 60_000).unref();
}
