ALTER TABLE "holdings" DROP CONSTRAINT "holdings_position_unique";--> statement-breakpoint
DROP INDEX "groups_one_reserved";--> statement-breakpoint
ALTER TABLE "holdings" ALTER COLUMN "account_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "holdings" ALTER COLUMN "cost" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "holdings" ADD CONSTRAINT "holdings_account_fk" FOREIGN KEY ("account_id","user_id") REFERENCES "public"."accounts"("id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groups" DROP COLUMN "reserved";--> statement-breakpoint
ALTER TABLE "holdings" DROP COLUMN "custodian";--> statement-breakpoint
ALTER TABLE "holdings" ADD CONSTRAINT "holdings_position_unique" UNIQUE("user_id","symbol","account_id");