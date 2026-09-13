import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { assertTestDatabase, testDatabaseUrl } from "./testDatabase";

export default async function setup() {
    const name = assertTestDatabase(testDatabaseUrl);

    const maintenance = new URL(testDatabaseUrl);
    maintenance.pathname = "/postgres";
    const admin = postgres(maintenance.toString(), { onnotice: () => {} });
    try {
        const [exists] = await admin`select 1 from pg_database where datname = ${name}`;
        if (!exists) await admin.unsafe(`create database "${name.replaceAll('"', '""')}"`);
    } finally {
        await admin.end();
    }

    const client = postgres(testDatabaseUrl, { onnotice: () => {} });
    try {
        await migrate(drizzle({ client }), {
            migrationsFolder: fileURLToPath(new URL("../drizzle", import.meta.url)),
        });
    } finally {
        await client.end();
    }
}
