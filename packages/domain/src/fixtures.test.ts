import { describe, expect, it } from "vitest";
import {
    FIXTURE_ACCOUNTS,
    FIXTURE_BUDGETS,
    FIXTURE_HOLDINGS,
    FIXTURE_SNAPSHOTS,
    FIXTURE_TAGS,
    FIXTURE_TRANSACTIONS,
    netWorth,
    snapshotNet,
    spendByTag,
} from "./index";

describe("fixtures", () => {
    it("spend July exactly as their comment says", () => {
        const july = spendByTag(FIXTURE_TRANSACTIONS, FIXTURE_BUDGETS, FIXTURE_TAGS, "2026-07");

        expect(july.tags.map((row) => [row.label, row.spent])).toEqual([
            ["Housing", 137500],
            ["Groceries", 38642],
            ["Eating out", 21435],
            ["Transport", 9280],
            ["Subscriptions", 4796],
            ["Other", 12810],
        ]);
        expect(july.spent).toBe(224463);
    });

    it("tag every expense, so nothing lands in Untagged", () => {
        const july = spendByTag(FIXTURE_TRANSACTIONS, FIXTURE_BUDGETS, FIXTURE_TAGS, "2026-07");

        expect(july.tags.some((row) => row.tagId === undefined)).toBe(false);
    });

    it("close their last month on today's net worth", () => {
        expect(netWorth(FIXTURE_ACCOUNTS, FIXTURE_HOLDINGS)).toBe(5696136);
        expect(snapshotNet(FIXTURE_SNAPSHOTS.at(-1)!)).toBe(5696136);
    });

    it("cover 36 consecutive months ending July 2026", () => {
        const expected = Array.from({ length: 36 }, (_, index) =>
            new Date(Date.UTC(2023, 7 + index, 1)).toISOString().slice(0, 7),
        );

        expect(FIXTURE_SNAPSHOTS.map((snapshot) => snapshot.period)).toEqual(expected);
    });
});
