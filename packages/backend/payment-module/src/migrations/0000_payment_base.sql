-- Baseline CONVERGENTE: todo comando é condicional, porque um baseline descreve o estado desejado e
-- pode encontrar o banco em qualquer situação anterior (lição do `notification-module@0.1.0`).

CREATE SCHEMA IF NOT EXISTS "payment";
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payment"."subscriptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid,
  "customer_ref" varchar(200),
  "provider" varchar(40) NOT NULL,
  "external_id" varchar(200) NOT NULL,
  "customer_email" varchar(320),
  "customer_name" varchar(255),
  "plan_code" varchar(40) NOT NULL,
  "offer_code" varchar(200),
  "payment_method" varchar(20),
  "status" varchar(20) NOT NULL,
  "period_ends_at" timestamp with time zone,
  "canceled_at" timestamp with time zone,
  "last_event_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payment"."payment_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid,
  "provider" varchar(40) NOT NULL,
  "external_id" varchar(200) NOT NULL,
  "type" varchar(40) NOT NULL,
  "provider_event_type" varchar(120) NOT NULL,
  "occurred_at" timestamp with time zone NOT NULL,
  "subscription_id" uuid,
  "customer_ref" varchar(200),
  "customer_email" varchar(320),
  "offer_code" varchar(200),
  "transaction_id" varchar(200),
  "payment_method" varchar(20),
  "amount_cents" integer,
  "currency" varchar(3),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "payment"."payment_events" ADD CONSTRAINT "payment_events_subscription_id_fk"
    FOREIGN KEY ("subscription_id") REFERENCES "payment"."subscriptions"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_subscriptions_provider_external" ON "payment"."subscriptions" ("provider", "external_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_subscriptions_customer" ON "payment"."subscriptions" ("company_id", "customer_ref");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_subscriptions_email" ON "payment"."subscriptions" (lower("customer_email"));
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_subscriptions_status" ON "payment"."subscriptions" ("company_id", "status");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_payment_events_provider_external" ON "payment"."payment_events" ("provider", "external_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_payment_events_occurred" ON "payment"."payment_events" ("company_id", "occurred_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_payment_events_subscription" ON "payment"."payment_events" ("subscription_id");
