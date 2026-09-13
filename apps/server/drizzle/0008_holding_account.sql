ALTER TABLE "holdings" ADD COLUMN "account_id" uuid;--> statement-breakpoint
ALTER TABLE "holdings" ADD COLUMN "cost" bigint;--> statement-breakpoint
INSERT INTO "accounts" ("user_id", "name", "subtitle", "group_id", "balance", "provenance", "stated_at")
SELECT DISTINCT
    h."user_id",
    h."custodian",
    '',
    COALESCE(
        (SELECT g."id" FROM "groups" g
         WHERE g."user_id" = h."user_id" AND lower(g."name") = 'investments' LIMIT 1),
        (SELECT g."id" FROM "groups" g
         WHERE g."user_id" = h."user_id" ORDER BY g."position" LIMIT 1)
    ),
    0,
    'manual'::provenance,
    now()
FROM "holdings" h
WHERE NOT EXISTS (
    SELECT 1 FROM "accounts" a
    WHERE a."user_id" = h."user_id" AND lower(a."name") = lower(h."custodian")
);--> statement-breakpoint
UPDATE "holdings" h SET "account_id" = a."id"
FROM "accounts" a
WHERE a."user_id" = h."user_id" AND lower(a."name") = lower(h."custodian");--> statement-breakpoint
UPDATE "holdings" SET "cost" = round("quantity" * "price")::bigint WHERE "cost" IS NULL;
