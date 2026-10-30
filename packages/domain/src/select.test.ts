import { describe, expect, it } from "vitest";
import {
    byRecency,
    euros,
    forAccounts,
    itemsInScope,
    lastSyncedAt,
    latestPeriod,
    netWorth,
    netWorthGroups,
    netWorthItems,
    owesMoney,
    spendByTag,
} from "./index";
import type { Account, Budget, Group, Holding, Tag, Transaction } from "./index";

const cash: Group = { id: "g-cash", name: "Cash", position: 0, invests: false };
const investments: Group = { id: "g-inv", name: "Investments", position: 1, invests: true };
const debt: Group = { id: "g-debt", name: "Debt", position: 2, invests: false };
const groups = [cash, investments, debt];

const ing: Account = { id: "ing", name: "ING", subtitle: "", groupId: cash.id, balance: euros(3240.18), currency: "EUR", nativeBalance: euros(3240.18), provenance: "synced", lastSyncedAt: "2026-08-01T07:55:00Z" };
const savings: Account = { id: "savings", name: "Savings", subtitle: "", groupId: cash.id, balance: euros(18500), currency: "EUR", nativeBalance: euros(18500), provenance: "synced", lastSyncedAt: "2026-08-01T08:12:00Z" };
const loan: Account = { id: "loan", name: "DUO", subtitle: "", groupId: debt.id, balance: euros(-8750), currency: "EUR", nativeBalance: euros(-8750), provenance: "manual" };
const broker: Account = { id: "degiro", name: "DEGIRO", subtitle: "", groupId: investments.id, balance: euros(0), currency: "EUR", nativeBalance: euros(0), provenance: "manual" };
const vwrl: Holding = { id: "vwrl", symbol: "VWRL", name: "Vanguard FTSE All-World", type: "etf", accountId: broker.id, quantity: 224, cost: euros(0), heldSince: "2025-01-20", nativePrice: euros(117.9), currency: "EUR", price: euros(117.9) };

const housing: Tag = { id: "t-housing", name: "Housing", kind: "expense", position: 0 };
const groceries: Tag = { id: "t-groceries", name: "Groceries", kind: "expense", position: 1 };
const eatingOut: Tag = { id: "t-eating-out", name: "Eating out", kind: "expense", position: 2 };
const transport: Tag = { id: "t-transport", name: "Transport", kind: "expense", position: 3 };
const other: Tag = { id: "t-other", name: "Other", kind: "expense", position: 4 };
const holiday: Tag = { id: "t-holiday", name: "Holiday", kind: "expense", position: 5 };
const tags = [housing, groceries, eatingOut, transport, other, holiday];

function entry(fields: Pick<Transaction, "id" | "amount" | "occurredAt"> & Partial<Transaction>): Transaction {
    return { name: fields.id, kind: "expense", accountId: "ing", tagIds: [], ...fields };
}

const july = [
    entry({ id: "rent", tagIds: [housing.id], amount: euros(-1500), occurredAt: "2026-07-01T09:00:00Z" }),
    entry({ id: "ah", tagIds: [groceries.id], amount: euros(-300), occurredAt: "2026-07-05T17:00:00Z" }),
    entry({ id: "jumbo", tagIds: [groceries.id], amount: euros(-86.42), occurredAt: "2026-07-12T17:00:00Z" }),
    entry({ id: "ns", tagIds: [transport.id], amount: euros(-92.8), occurredAt: "2026-07-14T08:00:00Z" }),
    entry({ id: "cafe", tagIds: [eatingOut.id, holiday.id], amount: euros(-20), occurredAt: "2026-07-20T20:00:00Z" }),
    entry({ id: "salary", kind: "income", amount: euros(4150), occurredAt: "2026-07-25T06:00:00Z" }),
    entry({ id: "degiro", kind: "transfer", amount: euros(-800), occurredAt: "2026-07-24T09:30:00Z" }),
    entry({ id: "june", tagIds: [groceries.id], amount: euros(-50), occurredAt: "2026-06-30T21:59:59Z" }),
];

describe("net worth", () => {
    it("adds balances and holding values, with debt counting against", () => {
        expect(netWorth([ing, savings, loan], [vwrl])).toBe(3939978);
    });

    it("groups in the user's own order and drops empty groups", () => {
        const found = netWorthGroups(
            netWorthItems([...[loan, ing, savings], broker], [vwrl]),
            groups,
        );

        expect(found.map((entry) => [entry.group.name, entry.total])).toEqual([
            ["Cash", 2174018],
            ["Investments", 2640960],
            ["Debt", -875000],
        ]);
        expect(
            netWorthGroups(netWorthItems([ing], []), groups).map((entry) => entry.group.name),
        ).toEqual(["Cash"]);
    });

    it("reads a negative group total as money owed", () => {
        const found = netWorthGroups(netWorthItems([loan, ing], []), groups);
        const owed = found.find((entry) => entry.group.id === debt.id);

        expect(owesMoney(owed!.total)).toBe(true);
        expect(owesMoney(found[0]!.total)).toBe(false);
    });

    it("collapses each group to one line for the combined scope", () => {
        const found = netWorthGroups(netWorthItems([...[ing, loan], broker], [vwrl]), groups);

        expect(itemsInScope(found, "all")).toStrictEqual([
            { id: cash.id, label: "Cash", groupId: cash.id, value: 324018 },
            { id: investments.id, label: "Investments", groupId: investments.id, value: 2640960 },
            { id: debt.id, label: "Debt", groupId: debt.id, value: -875000 },
        ]);
        expect(itemsInScope(found, investments.id)).toStrictEqual([
            { id: broker.id, label: "DEGIRO", groupId: investments.id, value: 0 },
            { id: "vwrl", label: "VWRL", groupId: investments.id, value: 2640960 },
        ]);
        expect(itemsInScope(netWorthGroups(netWorthItems([ing], []), groups), debt.id)).toEqual([]);
    });

    it("knows the most recent sync, if any account synced", () => {
        expect(lastSyncedAt([ing, savings, loan])).toBe("2026-08-01T08:12:00Z");
        expect(lastSyncedAt([loan])).toBeUndefined();
    });
});

describe("spending", () => {
    const budgets: Budget[] = [
        { tagId: groceries.id, limit: euros(450) },
        { tagId: housing.id, limit: euros(1400) },
        { tagId: other.id, limit: euros(200) },
    ];

    it("rolls up a month's expenses by tag, in the user's own order", () => {
        expect(spendByTag(july, budgets, tags, "2026-07")).toStrictEqual({
            period: "2026-07",
            tags: [
                { tagId: housing.id, label: "Housing", spent: 150000, budget: { limit: 140000, pct: 100, over: true, gap: 10000 } },
                { tagId: groceries.id, label: "Groceries", spent: 38642, budget: { limit: 45000, pct: 86, over: false, gap: 6358 } },
                { tagId: eatingOut.id, label: "Eating out", spent: 2000 },
                { tagId: transport.id, label: "Transport", spent: 9280 },
                { tagId: other.id, label: "Other", spent: 0, budget: { limit: 20000, pct: 0, over: false, gap: 20000 } },
            ],
            spent: 199922,
            budgeted: 205000,
            left: 5078,
        });
    });

    it("counts a transaction under its first tag only, so the rest are labels", () => {
        const shop = entry({ id: "shop", tagIds: [groceries.id, holiday.id], amount: euros(-60), occurredAt: "2026-07-03T10:00:00Z" });

        expect(spendByTag([shop], [], tags, "2026-07").tags).toStrictEqual([
            { tagId: groceries.id, label: "Groceries", spent: 6000 },
        ]);
    });

    it("gives expenses with no tag a row of their own", () => {
        const loose = entry({ id: "loose", amount: euros(-12.5), occurredAt: "2026-07-10T10:00:00Z" });

        expect(spendByTag([loose], [], tags, "2026-07").tags).toStrictEqual([
            { label: "Untagged", spent: 1250 },
        ]);
    });

    it("counts every euro even when no budget catches it", () => {
        const summary = spendByTag(july, [{ tagId: groceries.id, limit: euros(450) }], tags, "2026-07");

        expect(summary.tags.map((row) => [row.label, row.spent, row.budget !== undefined])).toEqual([
            ["Housing", 150000, false],
            ["Groceries", 38642, true],
            ["Eating out", 2000, false],
            ["Transport", 9280, false],
        ]);
        expect([summary.spent, summary.budgeted, summary.left]).toEqual([199922, 45000, 0]);
    });

    it("never reports a negative amount left", () => {
        const tight: Budget[] = [
            { tagId: groceries.id, limit: euros(100) },
            { tagId: housing.id, limit: euros(100) },
            { tagId: other.id, limit: euros(100) },
        ];
        const summary = spendByTag(july, tight, tags, "2026-07");

        expect([summary.spent, summary.budgeted, summary.left]).toEqual([199922, 30000, 0]);
    });
});

describe("activity", () => {
    it("sorts newest first without reordering the input", () => {
        const input = [july[7]!, july[0]!, july[5]!];

        expect(byRecency(input).map((transaction) => transaction.id)).toEqual(["salary", "rent", "june"]);
        expect(input.map((transaction) => transaction.id)).toEqual(["june", "rent", "salary"]);
    });

    it("finds transfers arriving in an account, not just leaving it", () => {
        const move = entry({ id: "move", kind: "transfer", toAccountId: "savings", amount: euros(-100), occurredAt: "2026-07-26T10:00:00Z" });

        expect(forAccounts([...july, move], new Set(["savings"])).map((transaction) => transaction.id)).toEqual(["move"]);
    });

    it("knows the latest month with activity", () => {
        expect(latestPeriod(july)).toBe("2026-07");
        expect(latestPeriod([])).toBeUndefined();
    });
});
