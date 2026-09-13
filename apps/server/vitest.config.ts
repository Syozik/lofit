import { defineConfig } from "vitest/config";
import { testDatabaseUrl } from "./test/testDatabase.ts";

export default defineConfig({
    test: {
        env: {
            DATABASE_URL: testDatabaseUrl,
            DEV_USER_EMAIL: "tester@lofit.test",
            NODE_ENV: "test",
        },
        globalSetup: ["./test/globalSetup.ts"],
        setupFiles: ["./test/setup.ts"],
        fileParallelism: false,
    },
});
