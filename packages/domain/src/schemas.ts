import { z } from "zod";
import type { Cents } from "./money";
import { isDay, isInstant } from "./transaction";
import { CURRENCIES } from "./money";
import { ASSET_TYPES, TRANSACTION_KINDS } from "./types";
import { TAG_KINDS } from "./tag";

const centsSchema = z.int().transform((value) => value as Cents);

const MAX_TAGS = 10;

const instantSchema = z
    .string()
    .refine(isInstant, "Expected a UTC ISO-8601 instant, like 2026-07-29T17:42:00Z");

const daySchema = z.string().refine(isDay, "Expected a calendar day, like 2026-07-29");

export const newTransactionSchema = z
    .object({
        id: z.uuid().optional(),
        name: z.string().trim().min(1).max(200),
        kind: z.enum(TRANSACTION_KINDS),
        tagIds: z.array(z.uuid()).max(MAX_TAGS).default([]),
        accountId: z.uuid(),
        toAccountId: z.uuid().optional(),
        amount: centsSchema,
        toAmount: centsSchema.optional(),
        occurredAt: instantSchema,
        currency: z.enum(CURRENCIES).optional(),
    })
    .superRefine((entry, ctx) => {
        if (new Set(entry.tagIds).size !== entry.tagIds.length) {
            ctx.addIssue({ code: "custom", path: ["tagIds"], message: "The same tag twice" });
        }
        if (entry.kind === "transfer" && entry.tagIds.length > 0) {
            ctx.addIssue({ code: "custom", path: ["tagIds"], message: "Transfers have no tags" });
        }
        if (entry.toAccountId && entry.kind !== "transfer") {
            ctx.addIssue({ code: "custom", path: ["toAccountId"], message: "Only transfers have a destination" });
        }
        if (entry.toAmount !== undefined && (!entry.toAccountId || entry.toAmount <= 0)) {
            ctx.addIssue({ code: "custom", path: ["toAmount"], message: "Only transfers receive a positive amount" });
        }
        if (entry.toAccountId && entry.toAccountId === entry.accountId) {
            ctx.addIssue({ code: "custom", path: ["toAccountId"], message: "A transfer needs two different accounts" });
        }
        const signOk = entry.kind === "income" ? entry.amount > 0 : entry.amount < 0;
        if (!signOk) {
            ctx.addIssue({
                code: "custom",
                path: ["amount"],
                message: "Income is positive; expenses and transfers are negative",
            });
        }
    });

const quoteSchema = z.discriminatedUnion("source", [
    z.object({
        source: z.literal("yahoo"),
        symbol: z
            .string()
            .trim()
            .min(1)
            .max(24)
            .transform((symbol) => symbol.toUpperCase()),
    }),
    z.object({
        source: z.literal("coingecko"),
        id: z
            .string()
            .trim()
            .min(1)
            .max(64)
            .transform((id) => id.toLowerCase()),
    }),
]);

export const newHoldingSchema = z.object({
    symbol: z
        .string()
        .trim()
        .min(1)
        .max(20)
        .transform((symbol) => symbol.toUpperCase()),
    name: z.string().trim().min(1).max(200),
    type: z.enum(ASSET_TYPES),
    accountId: z.uuid(),
    quantity: z.number().positive(),
    price: centsSchema.refine((price) => price > 0, "Price must be positive"),
    currency: z.enum(CURRENCIES).default("EUR"),
    pricedAt: instantSchema.optional(),
    heldSince: daySchema.optional(),
    quote: quoteSchema.optional(),
});

export const newTagSchema = z.object({
    id: z.uuid().optional(),
    name: z.string().trim().min(1).max(40),
    kind: z.enum(TAG_KINDS).default("expense"),
});

export const SCREENSHOT_TYPES = [
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/gif",
    "application/pdf",
] as const;

const MAX_SCREENSHOT_BASE64 = 7_000_000;

export const screenshotImportSchema = z.object({
    image: z.string().min(1).max(MAX_SCREENSHOT_BASE64),
    mediaType: z.enum(SCREENSHOT_TYPES),
});

export const budgetLimitSchema = z.object({
    limit: centsSchema.refine((value) => value > 0, "A budget is a positive amount"),
});

export const newAccountSchema = z.object({
    id: z.uuid().optional(),
    name: z.string().trim().min(1).max(100),
    subtitle: z.string().trim().max(100).default(""),
    groupId: z.uuid(),
    balance: centsSchema,
    currency: z.enum(CURRENCIES).optional(),
});

export const accountBalanceSchema = z.object({
    balance: centsSchema,
});

export const holdingPatchSchema = z.object({
    quantity: z.number().positive(),
    cost: centsSchema.refine((cost) => cost >= 0, "Cost cannot be negative"),
    heldSince: daySchema.optional(),
});

export const sellHoldingSchema = z.object({
    quantity: z.number().positive(),
    price: centsSchema.refine((price) => price > 0, "Price must be positive"),
});

export const newGroupSchema = z.object({
    id: z.uuid().optional(),
    name: z.string().trim().min(1).max(40),
});

export const settingsSchema = z.object({
    currency: z.enum(CURRENCIES),
});
