CREATE TYPE "public"."tag_kind" AS ENUM('expense', 'income');--> statement-breakpoint
DROP INDEX "tags_user_name_unique";--> statement-breakpoint
ALTER TABLE "tags" ADD COLUMN "kind" "tag_kind" DEFAULT 'expense' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "tags_user_kind_name_unique" ON "tags" USING btree ("user_id","kind",lower("name"));--> statement-breakpoint
UPDATE "tags" SET "kind" = 'income' WHERE (lower("name") = 'salary' OR EXISTS (SELECT 1 FROM "transaction_tags" tt JOIN "transactions" t ON t."id" = tt."transaction_id" WHERE tt."tag_id" = "tags"."id" AND t."kind" = 'income')) AND NOT EXISTS (SELECT 1 FROM "transaction_tags" tt JOIN "transactions" t ON t."id" = tt."transaction_id" WHERE tt."tag_id" = "tags"."id" AND t."kind" <> 'income');--> statement-breakpoint
DELETE FROM "transaction_tags" tt USING "transactions" t WHERE t."id" = tt."transaction_id" AND t."kind" = 'transfer';
