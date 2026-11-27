CREATE SCHEMA IF NOT EXISTS "coupons";
--> statement-breakpoint
CREATE TABLE "coupons"."campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"title" varchar(160) DEFAULT '' NOT NULL,
	"text" text DEFAULT '' NOT NULL,
	"terms" text DEFAULT '' NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"discount_kind" varchar(10) NOT NULL,
	"discount_value" integer NOT NULL,
	"max_discount_cents" integer,
	"min_subtotal_cents" integer,
	"code_mode" varchar(10) NOT NULL,
	"fixed_code" varchar(32),
	"code_prefix" varchar(12),
	"usage_limit_total" integer,
	"usage_limit_per_customer" integer,
	"usage_limit_per_code" integer,
	"scope" jsonb DEFAULT '{"kind":"all"}'::jsonb NOT NULL,
	"is_automatic" boolean DEFAULT false NOT NULL,
	"lead_capture" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campaigns_discount_value_positive" CHECK ("discount_value" > 0),
	CONSTRAINT "campaigns_discount_percent_max" CHECK ("discount_kind" <> 'percent' or "discount_value" <= 100)
);
--> statement-breakpoint
CREATE TABLE "coupons"."coupons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"code" varchar(48) NOT NULL,
	"lead_id" uuid,
	"used_count" integer DEFAULT 0 NOT NULL,
	"status" varchar(10) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coupons"."leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"name" varchar(120),
	"phone" varchar(20),
	"email" varchar(254),
	"customer_ref" varchar(120),
	"coupon_code" varchar(48),
	"consent_text" text NOT NULL,
	"consented_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coupons"."redemptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"coupon_code" varchar(48),
	"order_kind" varchar(40) NOT NULL,
	"order_id" varchar(120) NOT NULL,
	"customer_ref" varchar(120),
	"subtotal_cents" integer NOT NULL,
	"discount_cents" integer NOT NULL,
	"status" varchar(10) DEFAULT 'redeemed' NOT NULL,
	"redeemed_at" timestamp with time zone NOT NULL,
	"released_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "coupons"."coupons" ADD CONSTRAINT "coupons_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "coupons"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupons"."leads" ADD CONSTRAINT "leads_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "coupons"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupons"."redemptions" ADD CONSTRAINT "redemptions_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "coupons"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_campaigns_company_created" ON "coupons"."campaigns" USING btree ("company_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_campaigns_automatic" ON "coupons"."campaigns" USING btree ("company_id") WHERE "is_automatic" and "is_active";--> statement-breakpoint
CREATE UNIQUE INDEX "idx_coupons_company_code" ON "coupons"."coupons" USING btree ("company_id","code");--> statement-breakpoint
CREATE INDEX "idx_coupons_campaign" ON "coupons"."coupons" USING btree ("campaign_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_coupons_unassigned" ON "coupons"."coupons" USING btree ("campaign_id") WHERE "lead_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_leads_campaign_phone" ON "coupons"."leads" USING btree ("campaign_id","phone") WHERE "phone" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_leads_campaign_email" ON "coupons"."leads" USING btree ("campaign_id","email") WHERE "email" is not null;--> statement-breakpoint
CREATE INDEX "idx_leads_company_campaign_created" ON "coupons"."leads" USING btree ("company_id","campaign_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_redemptions_company_order" ON "coupons"."redemptions" USING btree ("company_id","order_kind","order_id");--> statement-breakpoint
CREATE INDEX "idx_redemptions_campaign_status" ON "coupons"."redemptions" USING btree ("campaign_id","status","redeemed_at");--> statement-breakpoint
CREATE INDEX "idx_redemptions_campaign_customer" ON "coupons"."redemptions" USING btree ("campaign_id","customer_ref") WHERE "status" = 'redeemed';--> statement-breakpoint
CREATE INDEX "idx_redemptions_campaign_code" ON "coupons"."redemptions" USING btree ("campaign_id","coupon_code") WHERE "status" = 'redeemed';