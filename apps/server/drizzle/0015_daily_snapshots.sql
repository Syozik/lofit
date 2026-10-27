ALTER TABLE "snapshots" DROP CONSTRAINT "snapshots_period_is_month";--> statement-breakpoint
ALTER TABLE "snapshots" DROP CONSTRAINT "snapshots_user_id_period_group_id_pk";--> statement-breakpoint
ALTER TABLE "snapshots" ADD COLUMN "day" date;--> statement-breakpoint
UPDATE "snapshots" SET "day" = (to_date("period" || '-01', 'YYYY-MM-DD') + interval '1 month' - interval '1 day')::date;--> statement-breakpoint
ALTER TABLE "snapshots" ALTER COLUMN "day" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "snapshots" ADD CONSTRAINT "snapshots_user_id_day_group_id_pk" PRIMARY KEY("user_id","day","group_id");--> statement-breakpoint
ALTER TABLE "snapshots" DROP COLUMN "period";
