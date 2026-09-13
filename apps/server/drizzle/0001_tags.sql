CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tags_id_user_unique" UNIQUE("id","user_id")
);
--> statement-breakpoint
CREATE TABLE "transaction_tags" (
	"transaction_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "transaction_tags_transaction_id_tag_id_pk" PRIMARY KEY("transaction_id","tag_id")
);
--> statement-breakpoint
ALTER TABLE "budgets" ADD COLUMN "tag_id" uuid;
--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_id_user_unique" UNIQUE("id","user_id");
--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "transaction_tags" ADD CONSTRAINT "transaction_tags_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "transaction_tags" ADD CONSTRAINT "transaction_tags_transaction_fk" FOREIGN KEY ("transaction_id","user_id") REFERENCES "public"."transactions"("id","user_id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "transaction_tags" ADD CONSTRAINT "transaction_tags_tag_fk" FOREIGN KEY ("tag_id","user_id") REFERENCES "public"."tags"("id","user_id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "tags_user_name_unique" ON "tags" USING btree ("user_id",lower("name"));
--> statement-breakpoint
CREATE UNIQUE INDEX "transaction_tags_one_owner" ON "transaction_tags" USING btree ("transaction_id") WHERE "transaction_tags"."position" = 0;
--> statement-breakpoint
CREATE INDEX "transaction_tags_tag_idx" ON "transaction_tags" USING btree ("user_id","tag_id");
--> statement-breakpoint
INSERT INTO "tags" ("user_id", "name", "position")
SELECT u."id", seed."name", seed."position"
FROM "users" u
CROSS JOIN (VALUES
    ('Housing', 0),
    ('Groceries', 1),
    ('Eating out', 2),
    ('Transport', 3),
    ('Subscriptions', 4),
    ('Other', 5)
) AS seed("name", "position");
--> statement-breakpoint
INSERT INTO "transaction_tags" ("transaction_id", "tag_id", "user_id", "position")
SELECT tr."id", tg."id", tr."user_id", 0
FROM "transactions" tr
JOIN "tags" tg ON tg."user_id" = tr."user_id" AND tg."name" = CASE tr."category"
        WHEN 'housing' THEN 'Housing'
        WHEN 'groceries' THEN 'Groceries'
        WHEN 'eatingOut' THEN 'Eating out'
        WHEN 'transport' THEN 'Transport'
        WHEN 'subscriptions' THEN 'Subscriptions'
        WHEN 'other' THEN 'Other'
    END
WHERE tr."category" IS NOT NULL;
--> statement-breakpoint
UPDATE "budgets" b
SET "tag_id" = tg."id"
FROM "tags" tg
WHERE tg."user_id" = b."user_id" AND tg."name" = CASE b."category"
        WHEN 'housing' THEN 'Housing'
        WHEN 'groceries' THEN 'Groceries'
        WHEN 'eatingOut' THEN 'Eating out'
        WHEN 'transport' THEN 'Transport'
        WHEN 'subscriptions' THEN 'Subscriptions'
        WHEN 'other' THEN 'Other'
    END;
