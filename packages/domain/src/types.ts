import type { Cents } from "./money";

export type GroupKey = "all" | "cash" | "inv" | "debt";

export type Provenance = "synced" | "manual" | "derived";

export const GROUP_ORDER: readonly GroupKey[] = ["all", "cash", "inv", "debt"];

export interface Position {
    label: string;
    value: Cents;
}
