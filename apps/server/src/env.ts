declare const process: { env: Record<string, string | undefined> };

const production = process.env.NODE_ENV === "production";

function required(name: string): string {
    const value = process.env[name];
    if (!value) throw new Error(`${name} is not set.`);
    return value;
}

function secret(name: string, devFallback: string): string {
    return production ? required(name) : (process.env[name] ?? devFallback);
}

const port = Number(process.env.PORT ?? 8787);

function baseUrl(): string {
    const configured = process.env.BASE_URL;
    if (configured?.startsWith("http")) return configured;
    if (production) throw new Error("BASE_URL must be the full https URL the app is served from.");
    return `http://localhost:${port}`;
}

function origins(): string[] {
    const configured = process.env.TRUSTED_ORIGINS;
    if (configured) return configured.split(",").map((origin) => origin.trim());
    return production ? [] : ["http://localhost:5173"];
}

export const env = {
    databaseUrl: required("DATABASE_URL"),
    port,
    baseUrl: baseUrl(),
    authSecret: secret("AUTH_SECRET", "lofit-development-secret-change-in-production"),
    trustedOrigins: origins(),
    devUserEmail: process.env.DEV_USER_EMAIL ?? "dev@lofit.local",
    devUserPassword: process.env.DEV_USER_PASSWORD ?? "lofit-dev-password",
    priceRefreshMinutes: Number(process.env.PRICE_REFRESH_MINUTES ?? 60),
    webRoot: process.env.WEB_ROOT,
    migrationsDir: process.env.MIGRATIONS_DIR ?? "./drizzle",
    production,
};
