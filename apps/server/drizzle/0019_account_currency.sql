ALTER TABLE "accounts" ADD COLUMN "currency" text DEFAULT 'EUR' NOT NULL;--> statement-breakpoint
ALTER TABLE "budgets" ADD COLUMN "currency" text DEFAULT 'EUR' NOT NULL;--> statement-breakpoint
ALTER TABLE "holdings" ADD COLUMN "cost_currency" text DEFAULT 'EUR' NOT NULL;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "to_amount" bigint;--> statement-breakpoint
UPDATE "accounts" SET "currency" = "users"."currency" FROM "users" WHERE "users"."id" = "accounts"."user_id";--> statement-breakpoint
UPDATE "budgets" SET "currency" = "users"."currency" FROM "users" WHERE "users"."id" = "budgets"."user_id";--> statement-breakpoint
UPDATE "holdings" SET "cost_currency" = "users"."currency" FROM "users" WHERE "users"."id" = "holdings"."user_id";--> statement-breakpoint
UPDATE "snapshots" SET "amount" = round("snapshots"."amount" / (
    SELECT "fx_rates"."per_euro" FROM "fx_rates"
    WHERE "fx_rates"."currency" = "users"."currency"
    ORDER BY "fx_rates"."day" > "snapshots"."day", abs("fx_rates"."day" - "snapshots"."day")
    LIMIT 1
))
FROM "users"
WHERE "users"."id" = "snapshots"."user_id"
    AND "users"."currency" <> 'EUR'
    AND EXISTS (SELECT 1 FROM "fx_rates" WHERE "fx_rates"."currency" = "users"."currency");
