import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { auth } from "./auth";

export type AuthEnv = { Variables: { userId: string } };

export const requireSession = createMiddleware<AuthEnv>(async (c, next) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });

    if (!session) {
        throw new HTTPException(401, { message: "Sign in required" });
    }

    c.set("userId", session.user.id);
    await next();
});
