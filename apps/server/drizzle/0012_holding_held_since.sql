ALTER TABLE "holdings" ADD COLUMN "held_since" date DEFAULT now() NOT NULL;--> statement-breakpoint
UPDATE "holdings" SET "held_since" = "created_at"::date;