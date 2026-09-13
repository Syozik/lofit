import { afterAll, beforeEach } from "vitest";
import { connection } from "../src/db/client";
import { env } from "../src/env";
import { assertTestDatabase } from "./testDatabase";

beforeEach(async () => {
    assertTestDatabase(env.databaseUrl);
    await connection`truncate table transaction_tags, transactions, budgets, snapshots, holdings, accounts, groups, tags, auth_sessions, auth_accounts, auth_verifications, users`;
});

afterAll(async () => {
    await connection.end();
});
