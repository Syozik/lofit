import { describe, expect, it } from "vitest";
import { newHoldingSchema, newTagSchema, newTransactionSchema } from "./schemas";

function issuePaths(result: { error?: { issues: readonly { path: readonly PropertyKey[] }[] } | undefined }) {
    return result.error?.issues.map((issue) => issue.path.join(".")) ?? [];
}

describe("newTransactionSchema", () => {
    const groceries = "3f2b6c40-9a1e-4d7b-8c53-2e9f4a7b1c08";
    const holiday = "6a9d1e22-7c48-4b3f-9e81-5d0c3a2b6f74";
    const valid = {
        name: "Albert Heijn",
        kind: "expense",
        tagIds: [groceries],
        accountId: "5f1c7a0e-3b4d-4c8e-9a2f-1d6b8e4c2a10",
        amount: -4218,
        occurredAt: "2026-07-29T17:42:00Z",
    };
    const otherAccount = "8d3e2b1a-6c5f-4e7d-b8a9-0f1e2d3c4b5a";

    it("accepts a well-formed expense", () => {
        expect(newTransactionSchema.parse(valid)).toStrictEqual(valid);
    });

    it("accepts several tags, and income carrying one", () => {
        expect(newTransactionSchema.parse({ ...valid, tagIds: [groceries, holiday] }).tagIds).toEqual([groceries, holiday]);
        expect(newTransactionSchema.parse({ ...valid, kind: "income", amount: 415000 }).tagIds).toEqual([groceries]);
    });

    it("leaves an entry with no tags alone", () => {
        const { tagIds: _tagIds, ...untagged } = valid;

        expect(newTransactionSchema.parse(untagged).tagIds).toEqual([]);
    });

    it.each([
        ["the same tag twice", { tagIds: [groceries, groceries] }, ["tagIds"]],
        ["a tag id that is not a uuid", { tagIds: ["groceries"] }, ["tagIds.0"]],
        ["more tags than any entry needs", { tagIds: Array.from({ length: 11 }, (_, index) => `${index.toString(16).padStart(8, "0")}-0000-4000-8000-000000000000`) }, ["tagIds"]],
        ["a destination on an expense", { toAccountId: otherAccount }, ["toAccountId"]],
        ["a transfer to the same account", { kind: "transfer", toAccountId: valid.accountId }, ["toAccountId"]],
        ["a positive expense", { amount: 4218 }, ["amount"]],
        ["negative income", { kind: "income", amount: -100 }, ["amount"]],
        ["a zero amount", { amount: 0 }, ["amount"]],
        ["fractional cents", { amount: -42.5 }, ["amount"]],
        ["an account id that is not a uuid", { accountId: "ing" }, ["accountId"]],
        ["a local time instead of UTC", { occurredAt: "2026-07-29T19:42:00+02:00" }, ["occurredAt"]],
        ["a bare date", { occurredAt: "2026-07-29" }, ["occurredAt"]],
    ])("rejects %s", (_label, patch, paths) => {
        expect(issuePaths(newTransactionSchema.safeParse({ ...valid, ...patch }))).toEqual(paths);
    });
});

describe("newTagSchema", () => {
    it("trims the name", () => {
        expect(newTagSchema.parse({ name: "  Holiday  " }).name).toBe("Holiday");
    });

    it.each([
        ["a blank name", { name: "   " }, ["name"]],
        ["a name nobody could read in a chip", { name: "x".repeat(41) }, ["name"]],
    ])("rejects %s", (_label, patch, paths) => {
        expect(issuePaths(newTagSchema.safeParse(patch))).toEqual(paths);
    });
});

describe("newHoldingSchema", () => {
    const valid = {
        symbol: " vwrl ",
        name: "Vanguard FTSE All-World",
        type: "etf",
        accountId: "6f1a7a3e-6f1a-4f1a-8f1a-6f1a7a3e6f1a",
        quantity: 0.5,
        price: 11790,
    };

    it("trims and uppercases the symbol", () => {
        expect(newHoldingSchema.parse(valid).symbol).toBe("VWRL");
    });

    it("normalises a quote reference", () => {
        const yahoo = newHoldingSchema.parse({ ...valid, quote: { source: "yahoo", symbol: " vwrl.as " } });
        const coingecko = newHoldingSchema.parse({ ...valid, quote: { source: "coingecko", id: " Bitcoin " } });

        expect([yahoo.quote, coingecko.quote]).toStrictEqual([
            { source: "yahoo", symbol: "VWRL.AS" },
            { source: "coingecko", id: "bitcoin" },
        ]);
    });

    it.each([
        ["a zero quantity", { quantity: 0 }, ["quantity"]],
        ["a zero price", { price: 0 }, ["price"]],
        ["a price with fractional cents", { price: 117.9 }, ["price"]],
        ["an unknown asset type", { type: "bond" }, ["type"]],
        ["an account that is not an id", { accountId: "DEGIRO" }, ["accountId"]],
        ["a pricedAt that is not a UTC instant", { pricedAt: "2026-08-07" }, ["pricedAt"]],
        ["a quote from nowhere in particular", { quote: { source: "bloomberg", symbol: "VWRL" } }, ["quote.source"]],
        ["a quote with no symbol", { quote: { source: "yahoo", symbol: "  " } }, ["quote.symbol"]],
    ])("rejects %s", (_label, patch, paths) => {
        expect(issuePaths(newHoldingSchema.safeParse({ ...valid, ...patch }))).toEqual(paths);
    });
});
