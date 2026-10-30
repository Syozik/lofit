import { describe, expect, it } from "vitest";
import { addCents, cents, euros, formatAmount, formatMoney, sumCents } from "./index";

describe("money", () => {
    it("rounds euros to whole cents so float noise never reaches a balance", () => {
        expect(euros(0.1 + 0.2)).toBe(30);
        expect(euros(19.99)).toBe(1999);
        expect(euros(-1284.4)).toBe(-128440);
    });

    it("refuses fractional cents", () => {
        expect(() => cents(1.5)).toThrow("Cents must be a whole number, got 1.5");
    });

    it("adds and sums in cents", () => {
        expect(addCents(euros(0.1), euros(0.2))).toBe(30);
        expect(sumCents([euros(3240.18), euros(-1284.4), euros(842.55)])).toBe(279833);
        expect(sumCents([])).toBe(0);
    });

    it("formats en-US amounts, with a true minus sign for negatives", () => {
        expect(formatAmount(euros(4150))).toBe("4,150.00");
        expect(formatAmount(euros(-42.18))).toBe("42.18");
        expect(formatMoney(euros(-1284.4))).toBe("− € 1,284.40");
        expect(formatMoney(euros(0))).toBe("€ 0.00");
    });
});
