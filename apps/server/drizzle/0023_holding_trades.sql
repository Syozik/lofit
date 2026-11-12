CREATE TYPE "public"."trade_side" AS ENUM('buy', 'sell');--> statement-breakpoint
CREATE TYPE "public"."trade_source" AS ENUM('manual', 'recurring', 'opening');--> statement-breakpoint
CREATE TABLE "holding_trades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"holding_id" uuid NOT NULL,
	"side" "trade_side" NOT NULL,
	"source" "trade_source" DEFAULT 'manual' NOT NULL,
	"day" date DEFAULT now() NOT NULL,
	"quantity" numeric(28, 10) NOT NULL,
	"price" bigint NOT NULL,
	"currency" text NOT NULL,
	"cost" bigint NOT NULL,
	"cost_currency" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "holding_trades_quantity_positive" CHECK ("holding_trades"."quantity" > 0)
);
--> statement-breakpoint
ALTER TABLE "holding_trades" ADD CONSTRAINT "holding_trades_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holding_trades" ADD CONSTRAINT "holding_trades_holding_id_holdings_id_fk" FOREIGN KEY ("holding_id") REFERENCES "public"."holdings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "holding_trades_holding_idx" ON "holding_trades" USING btree ("holding_id","day" DESC NULLS LAST);--> statement-breakpoint
INSERT INTO "holding_trades" ("user_id", "holding_id", "side", "source", "day", "quantity", "price", "currency", "cost", "cost_currency")
SELECT "user_id", "id", 'buy', 'opening', "held_since", "quantity", round("cost" / "quantity"), "cost_currency", "cost", "cost_currency"
FROM "holdings";
