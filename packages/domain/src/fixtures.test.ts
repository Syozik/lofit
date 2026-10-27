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

    it("cover every day from August 2023 to the end of July 2026", () => {
        const days = FIXTURE_SNAPSHOTS.map((snapshot) => snapshot.day);

        expect(days[0]).toBe("2023-08-31");
        expect(days.at(-1)).toBe("2026-07-31");
        expect(new Set(days).size).toBe(days.length);
        expect(days).toHaveLength(Math.round((Date.parse("2026-07-31") - Date.parse("2023-08-31")) / 86_400_000) + 1);
    });
});
