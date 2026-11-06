-- Baseline CONVERGENTE: todo comando é condicional. Um baseline descreve o estado desejado e
-- pode encontrar o banco em qualquer situação anterior a ele (a lição do notification-module@0.1.0).

CREATE SCHEMA IF NOT EXISTS "recommendation";
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "recommendation"."items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid,
  "kind" varchar(40) NOT NULL,
  "source" varchar(20) NOT NULL,
  "status" varchar(20) DEFAULT 'draft' NOT NULL,
  "title" varchar(160) NOT NULL,
  "summary" varchar(500),
  "image_url" text,
  "link_url" text,
  "city" varchar(120),
  "state" varchar(2),
  "min_age" smallint,
  "max_age" smallint,
  "tags" text[] DEFAULT '{}'::text[] NOT NULL,
  "attributes" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "sponsor_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "recommendation"."campaigns" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid,
  "item_id" uuid NOT NULL,
  "plan" varchar(40) NOT NULL,
  "status" varchar(20) DEFAULT 'active' NOT NULL,
  "priority" integer DEFAULT 0 NOT NULL,
  "starts_at" timestamp with time zone NOT NULL,
  "ends_at" timestamp with time zone,
  "placements" text[] DEFAULT '{}'::text[] NOT NULL,
  "external_reference" varchar(200),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "recommendation"."daily_stats" (
  "company_id" uuid,
  "item_id" uuid NOT NULL,
  "campaign_id" uuid DEFAULT '00000000-0000-0000-0000-000000000000' NOT NULL,
  "placement" varchar(40) NOT NULL,
  "day" date NOT NULL,
  "impressions" integer DEFAULT 0 NOT NULL,
  "clicks" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "recommendation"."campaigns" ADD CONSTRAINT "campaigns_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "recommendation"."items"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "recommendation"."daily_stats" ADD CONSTRAINT "daily_stats_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "recommendation"."items"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_items_company_status" ON "recommendation"."items" USING btree ("company_id","status","source");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_items_sponsor" ON "recommendation"."items" USING btree ("sponsor_id") WHERE "sponsor_id" is not null;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_items_tags" ON "recommendation"."items" USING gin ("tags");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_campaigns_item" ON "recommendation"."campaigns" USING btree ("item_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_campaigns_live" ON "recommendation"."campaigns" USING btree ("company_id","starts_at","ends_at") WHERE "status" = 'active';
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_daily_stats_key" ON "recommendation"."daily_stats" USING btree ("item_id","campaign_id","placement","day");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_daily_stats_day" ON "recommendation"."daily_stats" USING btree ("company_id","day");
