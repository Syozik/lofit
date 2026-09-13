CREATE TYPE "public"."account_group" AS ENUM('cash', 'inv', 'debt');--> statement-breakpoint
CREATE TYPE "public"."asset_type" AS ENUM('stock', 'etf', 'crypto', 'other');--> statement-breakpoint
CREATE TYPE "public"."category" AS ENUM('housing', 'groceries', 'eatingOut', 'transport', 'subscriptions', 'other');--> statement-breakpoint
CREATE TYPE "public"."provenance" AS ENUM('synced', 'manual', 'derived');--> statement-breakpoint
CREATE TYPE "public"."transaction_kind" AS ENUM('expense', 'income', 'transfer');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"subtitle" text NOT NULL,
	"group_key" "account_group" NOT NULL,
	"balance" bigint NOT NULL,
	"provenance" "provenance" NOT NULL,
	"last_synced_at" timestamp with time zone,
	"change" jsonb,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "accounts_id_user_unique" UNIQUE("id","user_id")
);
--> statement-breakpoint
CREATE TABLE "budgets" (
	"user_id" uuid NOT NULL,
	"category" "category" NOT NULL,
	"monthly_limit" bigint NOT NULL,
	CONSTRAINT "budgets_user_id_category_pk" PRIMARY KEY("user_id","category")
);
--> statement-breakpoint
CREATE TABLE "holdings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"symbol" text NOT NULL,
	"name" text NOT NULL,
	"type" "asset_type" NOT NULL,
	"custodian" text NOT NULL,
	"quantity" numeric(28, 10) NOT NULL,
	"price" bigint NOT NULL,
	"priced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "holdings_position_unique" UNIQUE("user_id","symbol","custodian"),
	CONSTRAINT "holdings_quantity_positive" CHECK ("holdings"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "snapshots" (
	"user_id" uuid NOT NULL,
	"period" text NOT NULL,
	"cash" bigint NOT NULL,
	"investments" bigint NOT NULL,
	"debt" bigint NOT NULL,
	CONSTRAINT "snapshots_user_id_period_pk" PRIMARY KEY("user_id","period"),
	CONSTRAINT "snapshots_period_is_month" CHECK ("snapshots"."period" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"kind" "transaction_kind" NOT NULL,
	"category" "category",
	"account_id" uuid NOT NULL,
	"to_account_id" uuid,
	"amount" bigint NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transactions_category_only_on_expense" CHECK ("transactions"."category" is null or "transactions"."kind" = 'expense'),
	CONSTRAINT "transactions_destination_only_on_transfer" CHECK ("transactions"."to_account_id" is null or "transactions"."kind" = 'transfer'),
	CONSTRAINT "transactions_not_to_itself" CHECK ("transactions"."to_account_id" is null or "transactions"."to_account_id" <> "transactions"."account_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holdings" ADD CONSTRAINT "holdings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snapshots" ADD CONSTRAINT "snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_fk" FOREIGN KEY ("account_id","user_id") REFERENCES "public"."accounts"("id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_to_account_fk" FOREIGN KEY ("to_account_id","user_id") REFERENCES "public"."accounts"("id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_user_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "transactions_user_occurred_idx" ON "transactions" USING btree ("user_id","occurred_at" DESC NULLS LAST);