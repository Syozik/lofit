import { describe, expect, it } from "vitest";
import { amountIn, deltaAt, euros, seriesFor, snapshotNet } from "./index";
import type { Snapshot } from "./index";

function month(day: string, cash: number, investments: number, debt: number): Snapshot {
    return {
        day,
        groups: [
            { groupId: "g-cash", amount: euros(cash) },
            { groupId: "g-inv", amount: euros(investments) },
            { groupId: "g-debt", amount: euros(debt) },
        ],
    };
}

const months: Snapshot[] = [
    month("2026-05-31", 1000, 5000, -2000),
    month("2026-06-30", 1100, 4800, -1900),
    month("2026-07-31", 1200, 5200, -1800),
];

describe("series", () => {
    it("read net worth for the combined scope and each group on its own", () => {
        expect(snapshotNet(months[0]!)).toBe(400000);
        expect(seriesFor(months, "all")).toEqual([400000, 400000, 460000]);
        expect(seriesFor(months, "g-inv")).toEqual([500000, 480000, 520000]);
        expect(seriesFor(months, "g-debt")).toEqual([-200000, -190000, -180000]);
    });

    it("read a group the month never recorded as zero", () => {
        expect(amountIn(months[0]!, "g-pension")).toBe(0);
        expect(seriesFor(months, "g-pension")).toEqual([0, 0, 0]);
    });
});

describe("deltaAt", () => {
    it("has nothing to compare for the first month or outside the series", () => {
        const net = seriesFor(months, "all");

        expect(deltaAt(net, 0)).toBeUndefined();
        expect(deltaAt(net, 3)).toBeUndefined();
        expect(deltaAt(net, -1)).toBeUndefined();
    });

    it("measures change against the previous month", () => {
        expect(deltaAt(seriesFor(months, "all"), 2)).toStrictEqual({ amount: 60000, pct: 15, favourable: true });
        expect(deltaAt(seriesFor(months, "g-inv"), 1)).toStrictEqual({ amount: -20000, pct: -4, favourable: false });
    });

    it("counts a flat month as no setback", () => {
        expect(deltaAt(seriesFor(months, "all"), 1)).toStrictEqual({ amount: 0, pct: 0, favourable: true });
    });

    it("reads shrinking debt as progress", () => {
        expect(deltaAt(seriesFor(months, "g-debt"), 2)).toStrictEqual({ amount: 10000, pct: 5.26, favourable: true });
    });
});
