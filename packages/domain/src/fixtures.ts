import { euros } from "./money";
import type { Account } from "./types";

export const FIXTURE_ACCOUNTS: readonly Account[] = [
    {
        id: "ing",
        name: "ING Betaalrekening",
        subtitle: "NL•• 4471 · checking",
        group: "cash",
        balance: euros(3240.18),
        provenance: "synced",
        lastSyncedAt: "2026-08-01T08:12:00Z",
    },
    {
        id: "spaar",
        name: "ING Oranje Spaarrekening",
        subtitle: "NL•• 4471 · savings · 1,7%",
        group: "cash",
        balance: euros(18500.0),
        provenance: "synced",
        lastSyncedAt: "2026-08-01T08:12:00Z",
    },
    {
        id: "rev",
        name: "Revolut",
        subtitle: "day-to-day card",
        group: "cash",
        balance: euros(842.55),
        provenance: "synced",
        lastSyncedAt: "2026-08-01T07:55:00Z",
    },
    {
        id: "degiro",
        name: "DEGIRO",
        subtitle: "brokerage · 3 positions",
        group: "inv",
        balance: euros(41930.72),
        provenance: "manual",
        positions: [
            { label: "VWRL · FTSE All-World", value: euros(26410.18) },
            { label: "ASML", value: euros(9204.5) },
            { label: "MSFT", value: euros(6316.04) },
        ],
    },
    {
        id: "cc",
        name: "Credit card",
        subtitle: "ICS · due 12 Aug",
        group: "debt",
        balance: euros(-1284.4),
        provenance: "synced",
        lastSyncedAt: "2026-08-01T08:12:00Z",
    },
    {
        id: "loan",
        name: "Studieschuld",
        subtitle: "DUO · 0,46%",
        group: "debt",
        balance: euros(-8750.0),
        provenance: "manual",
    },
];
