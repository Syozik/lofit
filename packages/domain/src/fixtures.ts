import type { Account } from "./account";
import { cents, EURO, euros } from "./money";
import type { Cents } from "./money";
import type { Holding } from "./holding";
import { accountsByGroup, netWorthItems, sumItems } from "./select";
import type { Snapshot } from "./snapshot";
import type { QuoteRef } from "./quote";
import { INVESTMENTS_GROUP } from "./group";
import type { Group } from "./group";
import { DEFAULT_TAGS } from "./tag";
import type { Tag } from "./tag";
import type { Transaction } from "./transaction";
import type { Budget } from "./types";

export const FIXTURE_ACCOUNTS: readonly Account[] = [
    {
        id: "ing",
        name: "ING Betaalrekening",
        subtitle: "NL•• 4471 · checking",
        groupId: "group-cash",
        balance: euros(3240.18),
        currency: EURO,
        nativeBalance: euros(3240.18),
        provenance: "synced",
        lastSyncedAt: "2026-08-01T08:12:00Z",
        change: { amount: euros(-212), period: "this month", favourable: false },
        details: [
            { label: "In this month", value: "+ € 4,150.00" },
            { label: "Out this month", value: "− € 2,244.63" },
        ],
    },
    {
        id: "spaar",
        name: "ING Oranje Spaarrekening",
        subtitle: "NL•• 4471 · savings · 1,7%",
        groupId: "group-cash",
        balance: euros(18500.0),
        currency: EURO,
        nativeBalance: euros(18500.0),
        provenance: "synced",
        lastSyncedAt: "2026-08-01T08:12:00Z",
        change: { amount: euros(500), period: "this month", favourable: true },
        details: [
            { label: "Interest YTD", value: "+ € 214.90" },
            { label: "Standing deposit", value: "€ 500.00 / month" },
        ],
    },
    {
        id: "rev",
        name: "Revolut",
        subtitle: "day-to-day card",
        groupId: "group-cash",
        balance: euros(842.55),
        currency: EURO,
        nativeBalance: euros(842.55),
        provenance: "synced",
        lastSyncedAt: "2026-08-01T07:55:00Z",
        change: { amount: euros(-68), period: "this month", favourable: false },
        details: [
            { label: "Card spend", value: "− € 168.22" },
            { label: "Top-ups", value: "+ € 100.00" },
        ],
    },
    {
        id: "cc",
        name: "Credit card",
        subtitle: "ICS · due 12 Aug",
        groupId: "group-debt",
        balance: euros(-1284.4),
        currency: EURO,
        nativeBalance: euros(-1284.4),
        provenance: "synced",
        lastSyncedAt: "2026-08-01T08:12:00Z",
        change: { amount: euros(-1284), period: "outstanding", favourable: false },
        details: [
            { label: "This cycle", value: "− € 1,284.40" },
            { label: "Limit", value: "€ 4,000.00" },
            { label: "Autopay", value: "On, full balance" },
        ],
    },
    {
        id: "loan",
        name: "Studieschuld",
        subtitle: "DUO · 0,46%",
        groupId: "group-debt",
        balance: euros(-8750.0),
        currency: EURO,
        nativeBalance: euros(-8750.0),
        provenance: "manual",
        change: { amount: euros(-145), period: "this month", favourable: true },
        details: [
            { label: "Monthly payment", value: "€ 145.00" },
            { label: "Paid off", value: "€ 4,250.00 of € 13,000.00" },
            { label: "Projected clear", value: "Mar 2031" },
        ],
    },
    {
        id: "degiro",
        name: "DEGIRO",
        subtitle: "brokerage",
        groupId: "group-investments",
        balance: euros(0),
        currency: EURO,
        nativeBalance: euros(0),
        provenance: "manual",
    },
    {
        id: "kraken",
        name: "Kraken",
        subtitle: "exchange",
        groupId: "group-investments",
        balance: euros(0),
        currency: EURO,
        nativeBalance: euros(0),
        provenance: "manual",
    },
];

export const FIXTURE_HOLDINGS: readonly Holding[] = [
    {
        id: "vwrl",
        symbol: "VWRL",
        name: "Vanguard FTSE All-World",
        type: "etf",
        accountId: "degiro",
        quantity: 224,
        cost: euros(20160.0),
        heldSince: "2024-03-12",
        nativePrice: euros(117.9),
        currency: EURO,
        price: euros(117.9),
        pricedAt: "2026-08-07T17:30:00Z",
        quote: { source: "yahoo", symbol: "VWRL.AS" } satisfies QuoteRef,
    },
    {
        id: "asml",
        symbol: "ASML",
        name: "ASML Holding",
        type: "stock",
        accountId: "degiro",
        quantity: 12,
        cost: euros(6480.0),
        heldSince: "2023-11-02",
        nativePrice: euros(767.04),
        currency: EURO,
        price: euros(767.04),
        pricedAt: "2026-08-07T17:30:00Z",
        quote: { source: "yahoo", symbol: "ASML.AS" } satisfies QuoteRef,
    },
    {
        id: "msft",
        symbol: "MSFT",
        name: "Microsoft",
        type: "stock",
        accountId: "degiro",
        quantity: 14,
        cost: euros(4340.0),
        heldSince: "2025-01-20",
        nativePrice: euros(451.15),
        currency: EURO,
        price: euros(451.15),
        pricedAt: "2026-08-07T20:00:00Z",
        quote: { source: "yahoo", symbol: "MSF.DE" } satisfies QuoteRef,
    },
    {
        id: "btc",
        symbol: "BTC",
        name: "Bitcoin",
        type: "crypto",
        accountId: "kraken",
        quantity: 0.0425,
        cost: euros(1615.0),
        heldSince: "2024-06-05",
        nativePrice: euros(58420),
        currency: EURO,
        price: euros(58420),
        pricedAt: "2026-08-08T06:15:00Z",
        quote: { source: "coingecko", id: "bitcoin" } satisfies QuoteRef,
    },
];

export const FIXTURE_TAGS: readonly Tag[] = DEFAULT_TAGS.map(({ name, kind }, position) => ({
    id: `tag-${name.toLowerCase().replace(/ /g, "-")}`,
    name,
    kind,
    position,
}));

export const FIXTURE_BUDGETS: readonly Budget[] = [
    { tagId: "tag-housing", limit: euros(1400) },
    { tagId: "tag-groceries", limit: euros(450) },
    { tagId: "tag-eating-out", limit: euros(200) },
    { tagId: "tag-transport", limit: euros(150) },
    { tagId: "tag-subscriptions", limit: euros(60) },
    { tagId: "tag-other", limit: euros(200) },
];

export const FIXTURE_TRANSACTIONS: readonly Transaction[] = [
    {
        id: "tx-ah-29",
        name: "Albert Heijn",
        kind: "expense",
        tagIds: ["tag-groceries"],
        accountId: "ing",
        amount: euros(-42.18),
        occurredAt: "2026-07-29T17:42:00Z",
    },
    {
        id: "tx-kobalt",
        name: "Café Kobalt",
        kind: "expense",
        tagIds: ["tag-eating-out"],
        accountId: "rev",
        amount: euros(-22.5),
        occurredAt: "2026-07-27T20:05:00Z",
    },
    {
        id: "tx-ah-26",
        name: "Albert Heijn",
        kind: "expense",
        tagIds: ["tag-groceries"],
        accountId: "ing",
        amount: euros(-61.3),
        occurredAt: "2026-07-26T11:18:00Z",
    },
    {
        id: "tx-salaris",
        name: "Salaris — Mistlab BV",
        kind: "income",
        tagIds: ["tag-salary"],
        accountId: "ing",
        amount: euros(4150.0),
        occurredAt: "2026-07-25T06:00:00Z",
    },
    {
        id: "tx-degiro",
        name: "DEGIRO deposit",
        kind: "transfer",
        tagIds: [],
        accountId: "ing",
        amount: euros(-800.0),
        occurredAt: "2026-07-24T09:30:00Z",
    },
    {
        id: "tx-ns-23",
        name: "NS Reizen",
        kind: "expense",
        tagIds: ["tag-transport"],
        accountId: "rev",
        amount: euros(-18.4),
        occurredAt: "2026-07-23T07:48:00Z",
    },
    {
        id: "tx-jumbo-22",
        name: "Jumbo",
        kind: "expense",
        tagIds: ["tag-groceries"],
        accountId: "ing",
        amount: euros(-78.95),
        occurredAt: "2026-07-22T18:22:00Z",
    },
    {
        id: "tx-rijsel",
        name: "Rijsel",
        kind: "expense",
        tagIds: ["tag-eating-out"],
        accountId: "rev",
        amount: euros(-48.9),
        occurredAt: "2026-07-21T21:14:00Z",
    },
    {
        id: "tx-spotify",
        name: "Spotify",
        kind: "expense",
        tagIds: ["tag-subscriptions"],
        accountId: "rev",
        amount: euros(-11.99),
        occurredAt: "2026-07-20T04:00:00Z",
    },
    {
        id: "tx-bol",
        name: "Bol.com",
        kind: "expense",
        tagIds: ["tag-other"],
        accountId: "ing",
        amount: euros(-48.6),
        occurredAt: "2026-07-19T13:37:00Z",
    },
    {
        id: "tx-toko",
        name: "Toko Bandung",
        kind: "expense",
        tagIds: ["tag-eating-out", "tag-holiday"],
        accountId: "rev",
        amount: euros(-34.6),
        occurredAt: "2026-07-18T19:02:00Z",
    },
    {
        id: "tx-ah-17",
        name: "Albert Heijn",
        kind: "expense",
        tagIds: ["tag-groceries"],
        accountId: "ing",
        amount: euros(-54.12),
        occurredAt: "2026-07-17T16:55:00Z",
    },
    {
        id: "tx-netflix",
        name: "Netflix",
        kind: "expense",
        tagIds: ["tag-subscriptions"],
        accountId: "rev",
        amount: euros(-12.99),
        occurredAt: "2026-07-16T04:00:00Z",
    },
    {
        id: "tx-ns-14",
        name: "NS Reizen",
        kind: "expense",
        tagIds: ["tag-transport"],
        accountId: "rev",
        amount: euros(-32.9),
        occurredAt: "2026-07-14T08:11:00Z",
    },
    {
        id: "tx-apotheek",
        name: "Apotheek Kwadrant",
        kind: "expense",
        tagIds: ["tag-other"],
        accountId: "ing",
        amount: euros(-29.95),
        occurredAt: "2026-07-13T10:26:00Z",
    },
    {
        id: "tx-sushi",
        name: "Sushi Kai",
        kind: "expense",
        tagIds: ["tag-eating-out"],
        accountId: "rev",
        amount: euros(-63.15),
        occurredAt: "2026-07-12T19:40:00Z",
    },
    {
        id: "tx-jumbo-11",
        name: "Jumbo",
        kind: "expense",
        tagIds: ["tag-groceries"],
        accountId: "ing",
        amount: euros(-89.4),
        occurredAt: "2026-07-11T12:03:00Z",
    },
    {
        id: "tx-icloud",
        name: "iCloud+",
        kind: "expense",
        tagIds: ["tag-subscriptions"],
        accountId: "rev",
        amount: euros(-8.99),
        occurredAt: "2026-07-10T04:00:00Z",
    },
    {
        id: "tx-shell",
        name: "Shell",
        kind: "expense",
        tagIds: ["tag-transport"],
        accountId: "ing",
        amount: euros(-41.5),
        occurredAt: "2026-07-08T15:19:00Z",
    },
    {
        id: "tx-strava",
        name: "Strava",
        kind: "expense",
        tagIds: ["tag-subscriptions"],
        accountId: "rev",
        amount: euros(-13.99),
        occurredAt: "2026-07-06T04:00:00Z",
    },
    {
        id: "tx-ekoplaza",
        name: "Ekoplaza",
        kind: "expense",
        tagIds: ["tag-groceries"],
        accountId: "rev",
        amount: euros(-60.47),
        occurredAt: "2026-07-05T17:31:00Z",
    },
    {
        id: "tx-bidon",
        name: "Bar Bidon",
        kind: "expense",
        tagIds: ["tag-eating-out"],
        accountId: "rev",
        amount: euros(-45.2),
        occurredAt: "2026-07-04T22:47:00Z",
    },
    {
        id: "tx-kruidvat",
        name: "Kruidvat",
        kind: "expense",
        tagIds: ["tag-other"],
        accountId: "ing",
        amount: euros(-49.55),
        occurredAt: "2026-07-03T14:08:00Z",
    },
    {
        id: "tx-huur",
        name: "Huur — Kwadrant",
        kind: "expense",
        tagIds: ["tag-housing"],
        accountId: "ing",
        amount: euros(-1375.0),
        occurredAt: "2026-07-01T09:05:00Z",
    },
    {
        id: "tx-duo",
        name: "Studieschuld DUO",
        kind: "transfer",
        tagIds: [],
        accountId: "ing",
        toAccountId: "loan",
        amount: euros(-145.0),
        occurredAt: "2026-07-01T06:30:00Z",
    },
];

export const FIXTURE_GROUPS: readonly Group[] = [
    { id: "group-cash", name: "Cash", position: 0, invests: false },
    { id: "group-investments", name: INVESTMENTS_GROUP, position: 1, invests: true },
    { id: "group-debt", name: "Debt", position: 2, invests: false },
];

function fixtureGroupTotal(groupId: string): Cents {
    return (
        accountsByGroup(FIXTURE_ACCOUNTS, FIXTURE_GROUPS).find(
            (entry) => entry.group.id === groupId,
        )?.total ?? cents(0)
    );
}

const MONTHLY_FIGURES: readonly {
    period: string;
    cash: number;
    investments: number;
    debt: number;
}[] = [
    { period: "2023-08", cash: 10890.1, investments: 18542.92, debt: -15114.4 },
    { period: "2023-09", cash: 11300.1, investments: 19732.32, debt: -14969.4 },
    { period: "2023-10", cash: 11040.1, investments: 19861.42, debt: -14824.4 },
    { period: "2023-11", cash: 11560.1, investments: 20979.21, debt: -14679.4 },
    { period: "2023-12", cash: 11955.1, investments: 22660.33, debt: -14534.4 },
    { period: "2024-01", cash: 11775.1, investments: 23052.45, debt: -14389.4 },
    { period: "2024-02", cash: 12245.1, investments: 24520.97, debt: -14244.4 },
    { period: "2024-03", cash: 12750.1, investments: 25590.7, debt: -14099.4 },
    { period: "2024-04", cash: 12430.1, investments: 25187.94, debt: -13954.4 },
    { period: "2024-05", cash: 12870.1, investments: 26945.08, debt: -13809.4 },
    { period: "2024-06", cash: 13385.1, investments: 28391.76, debt: -13664.4 },
    { period: "2024-07", cash: 13765.1, investments: 28851.06, debt: -13519.4 },
    { period: "2024-08", cash: 13620.1, investments: 30545.44, debt: -13374.4 },
    { period: "2024-09", cash: 14080.1, investments: 31895.26, debt: -13229.4 },
    { period: "2024-10", cash: 14605.1, investments: 31865.98, debt: -13084.4 },
    { period: "2024-11", cash: 14395.1, investments: 33781.29, debt: -12939.4 },
    { period: "2024-12", cash: 14890.1, investments: 34885.32, debt: -12794.4 },
    { period: "2025-01", cash: 15320.1, investments: 36627.23, debt: -12649.4 },
    { period: "2025-02", cash: 15045.1, investments: 35998.77, debt: -12504.4 },
    { period: "2025-03", cash: 15555.1, investments: 37590.74, debt: -12359.4 },
    { period: "2025-04", cash: 16020.1, investments: 39556.05, debt: -12214.4 },
    { period: "2025-05", cash: 16410.1, investments: 39762.71, debt: -12069.4 },
    { period: "2025-06", cash: 16250.1, investments: 41676.07, debt: -11924.4 },
    { period: "2025-07", cash: 16730.1, investments: 43184.56, debt: -11779.4 },
    { period: "2025-08", cash: 17250.1, investments: 45020.99, debt: -11634.4 },
    { period: "2025-09", cash: 18010.55, investments: 44983.12, debt: -11489.4 },
    { period: "2025-10", cash: 18620.3, investments: 43008.56, debt: -11344.4 },
    { period: "2025-11", cash: 19180.75, investments: 43987.39, debt: -11199.4 },
    { period: "2025-12", cash: 19840.2, investments: 43909.23, debt: -11054.4 },
    { period: "2026-01", cash: 20360.65, investments: 42811.88, debt: -10909.4 },
    { period: "2026-02", cash: 20910.4, investments: 43400.14, debt: -10764.4 },
    { period: "2026-03", cash: 21360.85, investments: 43679.96, debt: -10619.4 },
    { period: "2026-04", cash: 21740.3, investments: 41970.44, debt: -10474.4 },
    { period: "2026-05", cash: 22090.75, investments: 43425.98, debt: -10329.4 },
    { period: "2026-06", cash: 22380.2, investments: 43426.08, debt: -10184.4 },
];

const FIXTURE_GROUP_IDS = ["group-cash", "group-investments", "group-debt"] as const;

const MONTH_ENDS: readonly { day: string; amounts: readonly Cents[] }[] = [
    ...MONTHLY_FIGURES.map((row) => ({
        day: monthEnd(row.period),
        amounts: [euros(row.cash), euros(row.investments), euros(row.debt)],
    })),
    {
        day: "2026-07-31",
        amounts: [
            fixtureGroupTotal("group-cash"),
            sumItems(netWorthItems([], FIXTURE_HOLDINGS)),
            fixtureGroupTotal("group-debt"),
        ],
    },
];

const DAY_MS = 86_400_000;

function monthEnd(period: string): string {
    const [year = 0, month = 1] = period.split("-").map(Number);
    return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

function wobble(index: number, share: number): number {
    return Math.sin(Math.PI * share) * (Math.sin(index * 0.9) + Math.sin(index * 0.23)) * 0.012;
}

function snapshotOn(day: string, amounts: readonly number[]): Snapshot {
    return {
        day,
        groups: FIXTURE_GROUP_IDS.map((groupId, index) => ({
            groupId,
            amount: cents(Math.round(amounts[index] ?? 0)),
        })),
    };
}

function dailyBetween(
    from: (typeof MONTH_ENDS)[number],
    to: (typeof MONTH_ENDS)[number],
): Snapshot[] {
    const start = Date.parse(from.day);
    const days = Math.round((Date.parse(to.day) - start) / DAY_MS);

    return Array.from({ length: days }, (_, step) => {
        const share = (step + 1) / days;
        const index = Math.round(start / DAY_MS) + step + 1;
        const amounts = from.amounts.map((amount, group) => {
            const line = amount + ((to.amounts[group] ?? amount) - amount) * share;
            return group === 1 ? line * (1 + wobble(index, share)) : line;
        });
        return snapshotOn(new Date(start + (step + 1) * DAY_MS).toISOString().slice(0, 10), amounts);
    });
}

export const FIXTURE_SNAPSHOTS: readonly Snapshot[] = MONTH_ENDS.flatMap((point, index) => {
    const previous = MONTH_ENDS[index - 1];
    return previous ? dailyBetween(previous, point) : [snapshotOn(point.day, point.amounts)];
});
