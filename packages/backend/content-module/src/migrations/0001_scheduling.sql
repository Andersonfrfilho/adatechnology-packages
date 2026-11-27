CREATE TABLE "content"."post_former_slugs" (
	"company_id" uuid NOT NULL,
	"slug" varchar(120) NOT NULL,
	"post_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "post_former_slugs_company_id_slug_pk" PRIMARY KEY("company_id","slug")
);
--> statement-breakpoint
CREATE TABLE "content"."recurrence_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"template_id" uuid NOT NULL,
	"frequency" varchar(10) NOT NULL,
	"anchor_day" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"next_run_at" timestamp with time zone NOT NULL,
	"last_run_at" timestamp with time zone,
	"last_post_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "content"."posts" ADD COLUMN "short_id" varchar(6);--> statement-breakpoint
UPDATE "content"."posts" SET "short_id" = substr(md5("id"::text), 1, 6) WHERE "short_id" IS NULL;--> statement-breakpoint
ALTER TABLE "content"."posts" ALTER COLUMN "short_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "content"."posts" ADD COLUMN "tag_labels" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "content"."posts" ADD COLUMN "is_template" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "content"."post_former_slugs" ADD CONSTRAINT "post_former_slugs_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "content"."posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."recurrence_rules" ADD CONSTRAINT "recurrence_rules_template_id_posts_id_fk" FOREIGN KEY ("template_id") REFERENCES "content"."posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_recurrence_company" ON "content"."recurrence_rules" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_recurrence_due" ON "content"."recurrence_rules" USING btree ("next_run_at") WHERE "is_active";--> statement-breakpoint
CREATE UNIQUE INDEX "idx_posts_company_short_id" ON "content"."posts" USING btree ("company_id","short_id");--> statement-breakpoint
CREATE INDEX "idx_posts_due" ON "content"."posts" USING btree ("published_at") WHERE "status" = 'scheduled';