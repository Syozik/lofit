CREATE TABLE "fx_rates" (
	"day" date NOT NULL,
	"currency" text NOT NULL,
	"per_euro" numeric(18, 8) NOT NULL,
	CONSTRAINT "fx_rates_day_currency_pk" PRIMARY KEY("day","currency")
);
--> statement-breakpoint
ALTER TABLE "holdings" ADD COLUMN "native_price" bigint;--> statement-breakpoint
ALTER TABLE "holdings" ADD COLUMN "currency" text;--> statement-breakpoint
UPDATE "holdings" SET "native_price" = "price", "currency" = 'EUR' WHERE "currency" IS NULL;
