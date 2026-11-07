CREATE TABLE "recurring_buys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"symbol" text NOT NULL,
	"name" text NOT NULL,
	"type" "asset_type" NOT NULL,
	"quote" jsonb,
	"account_id" uuid NOT NULL,
	"from_account_id" uuid NOT NULL,
	"amount" bigint,
	"quantity" numeric(28, 10),
	"currency" text NOT NULL,
	"price" bigint NOT NULL,
	"price_currency" text NOT NULL,
	"cadence" text NOT NULL,
	"anchor" date NOT NULL,
	"next_due" date NOT NULL,
	"paused" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recurring_buys_one_basis" CHECK (("recurring_buys"."amount" is null) <> ("recurring_buys"."quantity" is null))
);
--> statement-breakpoint
ALTER TABLE "recurring_buys" ADD CONSTRAINT "recurring_buys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_buys" ADD CONSTRAINT "recurring_buys_account_fk" FOREIGN KEY ("account_id","user_id") REFERENCES "public"."accounts"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_buys" ADD CONSTRAINT "recurring_buys_from_account_fk" FOREIGN KEY ("from_account_id","user_id") REFERENCES "public"."accounts"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recurring_buys_due_idx" ON "recurring_buys" USING btree ("next_due");