import type { Cents } from "./money";

export const PROVENANCES = ["synced", "manual", "derived"] as const;

export type Provenance = (typeof PROVENANCES)[number];

export const ALL_GROUPS_LABEL = "All";

export const ASSET_TYPES = ["stock", "etf", "crypto", "other"] as const;

export type AssetType = (typeof ASSET_TYPES)[number];

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
    stock: "Stock",
    etf: "ETF",
    crypto: "Crypto",
    other: "Other",
};

export interface AccountChange {
    amount: Cents;
    period: string;
    favourable: boolean;
}

export interface AccountDetail {
    label: string;
    value: string;
}

export const TRANSACTION_KINDS = ["expense", "income", "transfer"] as const;

export type TransactionKind = (typeof TRANSACTION_KINDS)[number];

export const KIND_LABELS: Record<TransactionKind, string> = {
    expense: "Expense",
    income: "Income",
    transfer: "Transfer",
};

export interface Budget {
    tagId: string;
    limit: Cents;
}
