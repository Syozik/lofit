import { migrate } from "drizzle-orm/postgres-js/migrator";
import { env } from "../env";
import { connection, db } from "./client";

await migrate(db, { migrationsFolder: env.migrationsDir });
await connection.end();
console.log("migrations applied");
