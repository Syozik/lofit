import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { cents } from "@lofit/domain";
import type { ImportDraft } from "@lofit/domain";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { env } from "../env";

const MODEL = "claude-sonnet-5-5";

const SYSTEM = `You read screenshots for a personal finance app and turn them into ledger entries.

The screenshot is either a banking app or website showing a list of transactions, or a single receipt or invoice.
- A transaction list: return one entry per transaction row that is visible in full. Skip pending holds, balance lines and totals.
- A receipt: return a single entry for the amount actually paid (the grand total, after discounts and tips), named after the merchant. Do not list line items.

For every entry:
- name: the merchant or counterparty as a person would write it, without card numbers, terminal ids or reference codes.
- amount: the absolute amount as a decimal number in the currency shown.
- direction: "out" for money spent or sent, "in" for money received (salary, refunds, incoming transfers).
- day: the calendar day in YYYY-MM-DD. Resolve relative or partial dates ("Today", "Yesterday", "29 Jul") against the date the user gives. Use null when the screenshot shows no date for that entry.
- currency: the ISO 4217 code shown or implied; "EUR" when the screenshot uses € or shows no currency.
- account: the exact name of one of the user's accounts when the screenshot clearly belongs to it (bank name, card, IBAN tail), otherwise null.
- tag: the exact name of the user's tag that best fits the entry, otherwise null.

Return no entries when the image is not a transaction list or a receipt.`;

const extraction = z.object({
    entries: z.array(
        z.object({
            name: z.string(),
            amount: z.number(),
            direction: z.enum(["out", "in"]),
            day: z.string().nullable(),
            currency: z.string(),
            account: z.string().nullable(),
            tag: z.string().nullable(),
        }),
    ),
});

type Named = { id: string; name: string };

type Context = {
    image: string;
    mediaType: "image/png" | "image/jpeg" | "image/webp" | "image/gif";
    today: string;
    accounts: readonly Named[];
    tags: readonly Named[];
};

let client: Anthropic | undefined;

function anthropic(): Anthropic {
    if (!env.anthropicApiKey) {
        throw new HTTPException(501, { message: "Screenshot import is not configured" });
    }
    client ??= new Anthropic({ apiKey: env.anthropicApiKey });
    return client;
}

function byName(items: readonly Named[]) {
    const ids = new Map(items.map((item) => [item.name.toLowerCase(), item.id]));
    return (name: string | null) => (name ? ids.get(name.toLowerCase()) : undefined);
}

function isDay(value: string | null): value is string {
    return value !== null && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

export async function extractDrafts({
    image,
    mediaType,
    today,
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
                    {
                        type: "image",
                        source: { type: "base64", media_type: mediaType, data: image },
                    },
                    {
                        type: "text",
                        text: [
                            `Today is ${today}.`,
                            `My accounts: ${accounts.map((account) => account.name).join(", ") || "none"}.`,
                            `My tags: ${tags.map((tag) => tag.name).join(", ") || "none"}.`,
                        ].join("\n"),
                    },
                ],
            },
        ],
    });

    if (response.stop_reason === "refusal") {
        throw new HTTPException(422, { message: "This screenshot could not be read" });
    }
    if (!response.parsed_output) {
        throw new HTTPException(502, { message: "Could not read entries from the screenshot" });
    }

    const accountId = byName(accounts);
    const tagId = byName(tags);

    return response.parsed_output.entries
        .filter((entry) => entry.amount > 0 && entry.name.trim() !== "")
        .map((entry) => {
            const amount = Math.round(entry.amount * 100);
            const draft: ImportDraft = {
                name: entry.name.trim(),
                kind: entry.direction === "in" ? "income" : "expense",
                amount: cents(entry.direction === "in" ? amount : -amount),
                day: isDay(entry.day) ? entry.day : today,
                tagIds: [],
            };
            const account = accountId(entry.account);
            const tag = tagId(entry.tag);
            if (account) draft.accountId = account;
            if (tag) draft.tagIds = [tag];
            if (entry.currency.toUpperCase() !== "EUR")
                draft.currency = entry.currency.toUpperCase();
            return draft;
        });
}
