ALTER TABLE "transactions" DROP CONSTRAINT "transactions_category_only_on_expense";--> statement-breakpoint
ALTER TABLE "budgets" DROP CONSTRAINT "budgets_user_id_category_pk";--> statement-breakpoint
ALTER TABLE "budgets" ALTER COLUMN "tag_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_user_id_tag_id_pk" PRIMARY KEY("user_id","tag_id");--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_tag_fk" FOREIGN KEY ("tag_id","user_id") REFERENCES "public"."tags"("id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budgets" DROP COLUMN "category";--> statement-breakpoint
ALTER TABLE "transactions" DROP COLUMN "category";--> statement-breakpoint
DROP TYPE "public"."category";