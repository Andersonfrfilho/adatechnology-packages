CREATE SCHEMA "content";
--> statement-breakpoint
CREATE TABLE "content"."posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"slug" varchar(120) NOT NULL,
	"title" varchar(200) NOT NULL,
	"excerpt" varchar(500),
	"body" text DEFAULT '' NOT NULL,
	"cover_image_url" varchar(2048),
	"cover_image_alt" varchar(300),
	"tags" text[] DEFAULT '{}' NOT NULL,
	"status" varchar(12) DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"author_name" varchar(120),
	"seo_title" varchar(200),
	"seo_description" varchar(320),
	"canonical_url" varchar(2048),
	"reading_time_minutes" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "idx_posts_company_slug" ON "content"."posts" USING btree ("company_id","slug");--> statement-breakpoint
CREATE INDEX "idx_posts_company_status_published" ON "content"."posts" USING btree ("company_id","status","published_at");--> statement-breakpoint
CREATE INDEX "idx_posts_tags" ON "content"."posts" USING gin ("tags");