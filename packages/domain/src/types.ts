import type { Cents } from "./money";

export type GroupKey = "cash" | "inv" | "debt";

export type Provenance = "synced" | "manual" | "derived";

export const GROUP_ORDER: readonly GroupKey[] = ["cash", "inv", "debt"];

export interface Position {
    label: string;
    value: Cents;
}

export interface Account {
    id: string;
    name: string;
    subtitle: string;
    group: GroupKey;
    balance: Cents;
    provenance: Provenance;
    lastSyncedAt?: string;
    positions?: readonly Position[];
}
