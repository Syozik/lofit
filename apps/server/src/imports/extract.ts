import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { cents, tagsFor } from "@lofit/domain";
import type { ImportDraft, TagKind } from "@lofit/domain";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { env } from "../env";

const MODEL = "claude-sonnet-5-5";

const SYSTEM = `You read screenshots and bank statements for a personal finance app and turn them into ledger entries.

The input is one of:
- A banking app or website showing a list of transactions: return one entry per transaction row that is visible in full.
- A bank or card statement (often a PDF of several pages): return one entry per booked transaction on every page.
- A single receipt or invoice: return one entry for the amount actually paid (the grand total, after discounts and tips), named after the merchant. Do not list line items.

Skip pending holds, opening and closing balances, subtotals and totals.

For every entry:
- name: the merchant or counterparty as a person would write it, without card numbers, terminal ids or reference codes.
- amount: the absolute amount as a decimal number in the currency shown.
- direction: "out" for money spent or sent, "in" for money received (salary, refunds, incoming transfers).
- day: the booking day in YYYY-MM-DD. Resolve relative or partial dates ("Today", "Yesterday", "29 Jul") against the date the user gives and the statement period. Use null when no date is shown for that entry.
- currency: the ISO 4217 code shown or implied; the user's currency when the input shows no currency.
- account: the exact name of the user's account this list or statement belongs to (match bank name, card, IBAN tail or account name), otherwise null.
- ownAccount: when the money moved between two of the user's own accounts (a savings deposit, a card top-up, paying off the user's credit card, a transfer to or from the user's own IBAN), the exact name of the other account; otherwise null.
- tag: the exact name of the user's tag that best fits the entry, otherwise null. Pick spending tags for money out and income tags for money in. Use null for moves between the user's own accounts.

Return no entries when the input is not a transaction list, a statement or a receipt.`;

const extraction = z.object({
    entries: z.array(
        z.object({
            name: z.string(),
            amount: z.number(),
            direction: z.enum(["out", "in"]),
            day: z.string().nullable(),
            currency: z.string(),
            account: z.string().nullable(),
            ownAccount: z.string().nullable(),
            tag: z.string().nullable(),
        }),
    ),
});

type Named = { id: string; name: string };

type OwnAccount = Named & { subtitle: string };

type MediaType = "image/png" | "image/jpeg" | "image/webp" | "image/gif" | "application/pdf";

type Context = {
    image: string;
    mediaType: MediaType;
    today: string;
    currency: string;
    accounts: readonly OwnAccount[];
    tags: readonly (Named & { kind: TagKind })[];
};

let client: Anthropic | undefined;

function anthropic(): Anthropic {
    if (!env.anthropicApiKey) {
        throw new HTTPException(501, { message: "Importing is not configured" });
    }
    client ??= new Anthropic({ apiKey: env.anthropicApiKey });
    return client;
}

function byName(items: readonly Named[]) {
    const ids = new Map(items.map((item) => [item.name.toLowerCase(), item.id]));
    return (name: string | null) => (name ? ids.get(name.toLowerCase()) : undefined);
}

function source(data: string, mediaType: MediaType): Anthropic.Beta.BetaContentBlockParam {
    return mediaType === "application/pdf"
        ? { type: "document", source: { type: "base64", media_type: mediaType, data } }
        : { type: "image", source: { type: "base64", media_type: mediaType, data } };
}

function describe(account: OwnAccount): string {
    return account.subtitle ? `${account.name} (${account.subtitle})` : account.name;
}

function isDay(value: string | null): value is string {
    return value !== null && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

export async function extractDrafts({
    image,
    mediaType,
    today,
    currency,
    accounts,
    tags,
}: Context): Promise<ImportDraft[]> {
    const response = await anthropic().beta.messages.parse({
        model: MODEL,
        max_tokens: 16000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "low", format: betaZodOutputFormat(extraction) },
        system: SYSTEM,
        messages: [
            {
                role: "user",
                content: [
                    source(image, mediaType),
                    {
                        type: "text",
                        text: [
                            `Today is ${today}.`,
                            `My currency is ${currency}.`,
                            `My accounts: ${accounts.map(describe).join("; ") || "none"}.`,
                            `My spending tags: ${
                                tagsFor(tags, "expense")
                                    .map((tag) => tag.name)
                                    .join(", ") || "none"
                            }.`,
                            `My income tags: ${
                                tagsFor(tags, "income")
                                    .map((tag) => tag.name)
                                    .join(", ") || "none"
                            }.`,
                        ].join("\n"),
                    },
                ],
            },
        ],
    });

    if (response.stop_reason === "refusal") {
        throw new HTTPException(422, { message: "This file could not be read" });
    }
    if (!response.parsed_output) {
        throw new HTTPException(502, { message: "Could not read entries from this file" });
    }

    const accountId = byName(accounts);
    const spendingTag = byName(tagsFor(tags, "expense"));
    const incomeTag = byName(tagsFor(tags, "income"));

    return response.parsed_output.entries
        .filter((entry) => entry.amount > 0 && entry.name.trim() !== "")
        .map((entry) => {
            const amount = Math.round(entry.amount * 100);
            const account = accountId(entry.account);
            const other = accountId(entry.ownAccount);
            const moved = account !== undefined && other !== undefined && other !== account;
            const incoming = entry.direction === "in";
            const draft: ImportDraft = {
                name: entry.name.trim(),
                kind: moved ? "transfer" : incoming ? "income" : "expense",
                amount: cents(incoming && !moved ? amount : -amount),
                day: isDay(entry.day) ? entry.day : today,
                tagIds: [],
            };
            if (moved) {
                draft.accountId = incoming ? other : account;
                draft.toAccountId = incoming ? account : other;
            } else if (account) {
                draft.accountId = account;
            }
            const tag = (draft.kind === "income" ? incomeTag : spendingTag)(entry.tag);
            if (tag && !moved) draft.tagIds = [tag];
            if (entry.currency.toUpperCase() !== currency) {
                draft.currency = entry.currency.toUpperCase();
            }
            return draft;
        });
}
