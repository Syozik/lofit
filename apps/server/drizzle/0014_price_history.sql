CREATE TABLE "price_closes" (
	"key" text NOT NULL,
	"day" date NOT NULL,
	"close" bigint NOT NULL,
	CONSTRAINT "price_closes_key_day_pk" PRIMARY KEY("key","day")
);
--> statement-breakpoint
CREATE TABLE "price_series" (
	"key" text PRIMARY KEY NOT NULL,
	"currency" text NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "price_closes" ADD CONSTRAINT "price_closes_key_price_series_key_fk" FOREIGN KEY ("key") REFERENCES "public"."price_series"("key") ON DELETE cascade ON UPDATE no action;