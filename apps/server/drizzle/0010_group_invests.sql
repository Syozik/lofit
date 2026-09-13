ALTER TABLE "groups" ADD COLUMN "invests" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "groups" SET "invests" = true
WHERE lower("name") = 'investments'
   OR "id" IN (SELECT DISTINCT a."group_id" FROM "accounts" a JOIN "holdings" h ON h."account_id" = a."id");
