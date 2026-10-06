import { DEFAULT_GROUP_NAMES, DEFAULT_TAG_NAMES, INVESTMENTS_GROUP } from "@lofit/domain";
import { expo } from "@better-auth/expo";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer } from "better-auth/plugins/bearer";
import { db } from "../db/client";
import { authAccounts, authSessions, authVerifications, groups, tags, users } from "../db/schema";
import { env } from "../env";

export const auth = betterAuth({
    appName: "lofit",
    secret: env.authSecret,
    baseURL: env.baseUrl,
    basePath: "/api/auth",
    trustedOrigins: env.trustedOrigins,
    database: drizzleAdapter(db, {
        provider: "pg",
        schema: {
            user: users,
            session: authSessions,
            account: authAccounts,
            verification: authVerifications,
        },
    }),
    emailAndPassword: { enabled: true },
    databaseHooks: {
        user: {
            create: {
                after: async (user) => {
                    await db.insert(groups).values(
                        DEFAULT_GROUP_NAMES.map((name, position) => ({
                            userId: user.id,
                            name,
                            position,
                            invests: name === INVESTMENTS_GROUP,
                        })),
                    );

                    await db.insert(tags).values(
                        DEFAULT_TAG_NAMES.map((name, position) => ({
                            userId: user.id,
                            name,
                            position,
                        })),
                    );
                },
            },
        },
    },
    rateLimit: {
        customRules: {
            "/sign-in/email": { window: 60, max: 10 },
            "/sign-up/email": { window: 3600, max: 5 },
        },
    },
    advanced: {
        database: { generateId: "uuid" },
    },
    plugins: [bearer(), expo()],
});
