export const testDatabaseUrl =
    process.env.TEST_DATABASE_URL ?? "postgres://localhost:5432/lofit_test";

export function assertTestDatabase(url: string): string {
    const name = decodeURIComponent(new URL(url).pathname.slice(1));
    if (!name.endsWith("_test")) {
        throw new Error(`Refusing to run tests against "${name}": the database name must end in _test.`);
    }
    return name;
}
