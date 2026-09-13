CREATE TABLE "groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"position" integer NOT NULL,
	"reserved" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "groups_id_user_unique" UNIQUE("id","user_id")
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "group_id" uuid;--> statement-breakpoint
ALTER TABLE "snapshots" ADD COLUMN "group_id" uuid;--> statement-breakpoint
ALTER TABLE "snapshots" ADD COLUMN "amount" bigint;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "groups_user_name_unique" ON "groups" USING btree ("user_id",lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "groups_one_reserved" ON "groups" USING btree ("user_id") WHERE "groups"."reserved";--> statement-breakpoint
INSERT INTO "groups" ("user_id", "name", "position", "reserved")
SELECT u."id", 'Cash', 0, false FROM "users" u;--> statement-breakpoint
INSERT INTO "groups" ("user_id", "name", "position", "reserved")
SELECT u."id", 'Investments', 1, true FROM "users" u;--> statement-breakpoint
INSERT INTO "groups" ("user_id", "name", "position", "reserved")
SELECT DISTINCT a."user_id", 'Debt', 2, false FROM "accounts" a WHERE a."group_key"::text = 'debt';--> statement-breakpoint
UPDATE "accounts" a SET "group_id" = g."id"
FROM "groups" g
WHERE g."user_id" = a."user_id"
  AND g."name" = CASE a."group_key"::text
      WHEN 'cash' THEN 'Cash'
      WHEN 'inv' THEN 'Investments'
      WHEN 'debt' THEN 'Debt'
  END;
