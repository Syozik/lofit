import {
    ASSET_TYPES,
    PROVENANCES,
    TAG_KINDS,
    TRANSACTION_KINDS,
} from "@lofit/domain";
import type { AccountChange, AccountDetail, Cents, QuoteRef } from "@lofit/domain";
import { sql } from "drizzle-orm";
import {
    bigint,
    boolean,
    check,
    date,
    foreignKey,
    index,
    integer,
    jsonb,
    numeric,
    pgEnum,
    pgTable,
    primaryKey,
    text,
    timestamp,
    unique,
    uniqueIndex,
    uuid,
} from "drizzle-orm/pg-core";

export const provenance = pgEnum("provenance", PROVENANCES);
export const assetType = pgEnum("asset_type", ASSET_TYPES);
export const transactionKind = pgEnum("transaction_kind", TRANSACTION_KINDS);
export const tagKind = pgEnum("tag_kind", TAG_KINDS);

const money = (name: string) => bigint(name, { mode: "number" }).$type<Cents>();

const instant = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export const users = pgTable("users", {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull().unique(),
    name: text("name").notNull(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    createdAt: instant("created_at").notNull().defaultNow(),
    updatedAt: instant("updated_at").notNull().defaultNow(),
});

export const authSessions = pgTable(
    "auth_sessions",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        userId: uuid("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        token: text("token").notNull().unique(),
        expiresAt: instant("expires_at").notNull(),
        ipAddress: text("ip_address"),
        userAgent: text("user_agent"),
        createdAt: instant("created_at").notNull().defaultNow(),
        updatedAt: instant("updated_at").notNull().defaultNow(),
    },
    (table) => [index("auth_sessions_user_idx").on(table.userId)],
);

export const authAccounts = pgTable(
    "auth_accounts",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        userId: uuid("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        accountId: text("account_id").notNull(),
        providerId: text("provider_id").notNull(),
        password: text("password"),
        accessToken: text("access_token"),
        refreshToken: text("refresh_token"),
        idToken: text("id_token"),
        accessTokenExpiresAt: instant("access_token_expires_at"),
        refreshTokenExpiresAt: instant("refresh_token_expires_at"),
        scope: text("scope"),
        createdAt: instant("created_at").notNull().defaultNow(),
        updatedAt: instant("updated_at").notNull().defaultNow(),
    },
    (table) => [
        unique("auth_accounts_provider_unique").on(table.providerId, table.accountId),
        index("auth_accounts_user_idx").on(table.userId),
    ],
);

export const authVerifications = pgTable(
    "auth_verifications",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        identifier: text("identifier").notNull(),
        value: text("value").notNull(),
        expiresAt: instant("expires_at").notNull(),
        createdAt: instant("created_at").notNull().defaultNow(),
        updatedAt: instant("updated_at").notNull().defaultNow(),
    },
    (table) => [index("auth_verifications_identifier_idx").on(table.identifier)],
);

export const groups = pgTable(
    "groups",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        userId: uuid("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        name: text("name").notNull(),
        position: integer("position").notNull(),
        invests: boolean("invests").notNull().default(false),
        createdAt: instant("created_at").notNull().defaultNow(),
    },
    (t) => [
        unique("groups_id_user_unique").on(t.id, t.userId),
        uniqueIndex("groups_user_name_unique").on(t.userId, sql`lower(${t.name})`),
    ],
);

const owner = () =>
    uuid("user_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" });

export const accounts = pgTable(
    "accounts",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        userId: owner(),
        name: text("name").notNull(),
        subtitle: text("subtitle").notNull(),
        groupId: uuid("group_id").notNull(),
        balance: money("balance").notNull(),
        provenance: provenance("provenance").notNull(),
        lastSyncedAt: instant("last_synced_at"),
        statedAt: instant("stated_at"),
        change: jsonb("change").$type<AccountChange>(),
        details: jsonb("details").$type<readonly AccountDetail[]>(),
        createdAt: instant("created_at").notNull().defaultNow(),
    },
    (t) => [
        unique("accounts_id_user_unique").on(t.id, t.userId),
        foreignKey({
            name: "accounts_group_fk",
            columns: [t.groupId, t.userId],
            foreignColumns: [groups.id, groups.userId],
        }),
        index("accounts_user_idx").on(t.userId),
    ],
);

export const holdings = pgTable(
    "holdings",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        userId: owner(),
        symbol: text("symbol").notNull(),
        name: text("name").notNull(),
        type: assetType("type").notNull(),
        accountId: uuid("account_id").notNull(),
        cost: money("cost").notNull(),
        heldSince: date("held_since", { mode: "string" }).notNull().defaultNow(),
        quantity: numeric("quantity", { precision: 28, scale: 10, mode: "number" }).notNull(),
        price: money("price").notNull(),
        nativePrice: money("native_price"),
        currency: text("currency"),
        pricedAt: instant("priced_at"),
        quote: jsonb("quote").$type<QuoteRef>(),
        createdAt: instant("created_at").notNull().defaultNow(),
    },
    (t) => [
        unique("holdings_position_unique").on(t.userId, t.symbol, t.accountId),
        foreignKey({
            name: "holdings_account_fk",
            columns: [t.accountId, t.userId],
            foreignColumns: [accounts.id, accounts.userId],
        }),
        check("holdings_quantity_positive", sql`${t.quantity} > 0`),
    ],
);

export const tags = pgTable(
    "tags",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        userId: owner(),
        name: text("name").notNull(),
        kind: tagKind("kind").notNull().default("expense"),
        position: integer("position").notNull(),
        createdAt: instant("created_at").notNull().defaultNow(),
    },
    (t) => [
        uniqueIndex("tags_user_kind_name_unique").on(t.userId, t.kind, sql`lower(${t.name})`),
        unique("tags_id_user_unique").on(t.id, t.userId),
    ],
);

export const transactions = pgTable(
    "transactions",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        userId: owner(),
        name: text("name").notNull(),
        kind: transactionKind("kind").notNull(),
        accountId: uuid("account_id").notNull(),
        toAccountId: uuid("to_account_id"),
        amount: money("amount").notNull(),
        occurredAt: instant("occurred_at").notNull(),
        createdAt: instant("created_at").notNull().defaultNow(),
    },
    (t) => [
        foreignKey({
            name: "transactions_account_fk",
            columns: [t.accountId, t.userId],
            foreignColumns: [accounts.id, accounts.userId],
        }),
        foreignKey({
            name: "transactions_to_account_fk",
            columns: [t.toAccountId, t.userId],
            foreignColumns: [accounts.id, accounts.userId],
        }),
        unique("transactions_id_user_unique").on(t.id, t.userId),
        index("transactions_user_occurred_idx").on(t.userId, t.occurredAt.desc()),
        check("transactions_destination_only_on_transfer", sql`${t.toAccountId} is null or ${t.kind} = 'transfer'`),
        check("transactions_not_to_itself", sql`${t.toAccountId} is null or ${t.toAccountId} <> ${t.accountId}`),
    ],
);

export const transactionTags = pgTable(
    "transaction_tags",
    {
        transactionId: uuid("transaction_id").notNull(),
        tagId: uuid("tag_id").notNull(),
        userId: owner(),
        position: integer("position").notNull(),
    },
    (t) => [
        primaryKey({ columns: [t.transactionId, t.tagId] }),
        foreignKey({
            name: "transaction_tags_transaction_fk",
            columns: [t.transactionId, t.userId],
            foreignColumns: [transactions.id, transactions.userId],
        }).onDelete("cascade"),
        foreignKey({
            name: "transaction_tags_tag_fk",
            columns: [t.tagId, t.userId],
            foreignColumns: [tags.id, tags.userId],
        }),
        uniqueIndex("transaction_tags_one_owner").on(t.transactionId).where(sql`${t.position} = 0`),
        index("transaction_tags_tag_idx").on(t.userId, t.tagId),
    ],
);

export const budgets = pgTable(
    "budgets",
    {
        userId: owner(),
        tagId: uuid("tag_id").notNull(),
        limit: money("monthly_limit").notNull(),
    },
    (t) => [
        primaryKey({ columns: [t.userId, t.tagId] }),
        foreignKey({
            name: "budgets_tag_fk",
            columns: [t.tagId, t.userId],
            foreignColumns: [tags.id, tags.userId],
        }),
    ],
);

export const snapshots = pgTable(
    "snapshots",
    {
        userId: owner(),
        day: date("day", { mode: "string" }).notNull(),
        groupId: uuid("group_id").notNull(),
        amount: money("amount").notNull(),
    },
    (t) => [
        primaryKey({ columns: [t.userId, t.day, t.groupId] }),
        foreignKey({
            name: "snapshots_group_fk",
            columns: [t.groupId, t.userId],
            foreignColumns: [groups.id, groups.userId],
        }),
    ],
);

export const fxRates = pgTable(
    "fx_rates",
    {
        day: date("day", { mode: "string" }).notNull(),
        currency: text("currency").notNull(),
        perEuro: numeric("per_euro", { precision: 18, scale: 8, mode: "number" }).notNull(),
    },
    (t) => [primaryKey({ columns: [t.day, t.currency] })],
);

export const priceSeries = pgTable("price_series", {
    key: text("key").primaryKey(),
    currency: text("currency").notNull(),
    fetchedAt: instant("fetched_at").notNull(),
});

export const priceCloses = pgTable(
    "price_closes",
    {
        key: text("key")
            .notNull()
            .references(() => priceSeries.key, { onDelete: "cascade" }),
        day: date("day", { mode: "string" }).notNull(),
        close: money("close").notNull(),
    },
    (t) => [primaryKey({ columns: [t.key, t.day] })],
);
