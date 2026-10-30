import { EURO, isCurrency } from "@lofit/domain";
import type { Currency } from "@lofit/domain";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { auth } from "./auth";

export type AuthEnv = { Variables: { userId: string; currency: Currency } };

export const requireSession = createMiddleware<AuthEnv>(async (c, next) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });

    if (!session) {
        throw new HTTPException(401, { message: "Sign in required" });
    }

    c.set("userId", session.user.id);
    c.set("currency", isCurrency(session.user.currency) ? session.user.currency : EURO);
    await next();
});
