ALTER TABLE "snapshots" DROP CONSTRAINT "snapshots_user_id_period_pk";--> statement-breakpoint
INSERT INTO "groups" ("user_id", "name", "position", "reserved")
SELECT DISTINCT s."user_id", 'Debt', (
    SELECT COALESCE(MAX(g2."position"), -1) + 1 FROM "groups" g2 WHERE g2."user_id" = s."user_id"
), false
FROM "snapshots" s
WHERE s."debt" <> 0
  AND NOT EXISTS (
      SELECT 1 FROM "groups" g WHERE g."user_id" = s."user_id" AND g."name" = 'Debt'
  );--> statement-breakpoint
UPDATE "snapshots" s SET "group_id" = g."id", "amount" = s."cash"
FROM "groups" g
WHERE g."user_id" = s."user_id" AND g."name" = 'Cash';--> statement-breakpoint
INSERT INTO "snapshots" ("user_id", "period", "group_id", "amount", "cash", "investments", "debt")
SELECT s."user_id", s."period", gi."id", s."investments", 0, 0, 0
FROM "snapshots" s
JOIN "groups" gc ON gc."user_id" = s."user_id" AND gc."name" = 'Cash' AND gc."id" = s."group_id"
JOIN "groups" gi ON gi."user_id" = s."user_id" AND gi."name" = 'Investments';--> statement-breakpoint
INSERT INTO "snapshots" ("user_id", "period", "group_id", "amount", "cash", "investments", "debt")
SELECT s."user_id", s."period", gd."id", s."debt", 0, 0, 0
FROM "snapshots" s
JOIN "groups" gc ON gc."user_id" = s."user_id" AND gc."name" = 'Cash' AND gc."id" = s."group_id"
JOIN "groups" gd ON gd."user_id" = s."user_id" AND gd."name" = 'Debt';--> statement-breakpoint
DELETE FROM "snapshots" WHERE "group_id" IS NULL;--> statement-breakpoint
ALTER TABLE "accounts" ALTER COLUMN "group_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "snapshots" ALTER COLUMN "group_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "snapshots" ALTER COLUMN "amount" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "snapshots" ADD CONSTRAINT "snapshots_user_id_period_group_id_pk" PRIMARY KEY("user_id","period","group_id");--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_group_fk" FOREIGN KEY ("group_id","user_id") REFERENCES "public"."groups"("id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snapshots" ADD CONSTRAINT "snapshots_group_fk" FOREIGN KEY ("group_id","user_id") REFERENCES "public"."groups"("id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" DROP COLUMN "group_key";--> statement-breakpoint
ALTER TABLE "snapshots" DROP COLUMN "cash";--> statement-breakpoint
ALTER TABLE "snapshots" DROP COLUMN "investments";--> statement-breakpoint
ALTER TABLE "snapshots" DROP COLUMN "debt";--> statement-breakpoint
DROP TYPE "public"."account_group";