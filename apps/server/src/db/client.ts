import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../env";
import * as schema from "./schema";

export const connection = postgres(env.databaseUrl);
export const db = drizzle({ client: connection, schema });
