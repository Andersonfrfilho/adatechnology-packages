-- `EXCLUDE USING gist (resource_id WITH =, blocking WITH &&)` (T2.3) precisa de `btree_gist`
-- para casar igualdade de `uuid` num índice GIST — sem a extensão a constraint abaixo falha com
-- "operator class btree_gist for access method gist does not exist". Em Postgres gerenciado
-- (RDS, Cloud SQL) está na allowlist; em instalação restrita, um DBA roda esta linha antes.
CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint
CREATE SCHEMA "scheduling";
--> statement-breakpoint
CREATE TABLE "scheduling"."availability_exceptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"resource_id" uuid NOT NULL,
	"during_start" timestamp with time zone NOT NULL,
	"during_end" timestamp with time zone NOT NULL,
	"kind" varchar(8) NOT NULL,
	"reason" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scheduling"."availability_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"resource_id" uuid NOT NULL,
	"weekday" smallint NOT NULL,
	"starts_at_local" varchar(5) NOT NULL,
	"ends_at_local" varchar(5) NOT NULL,
	"valid_from" timestamp with time zone,
	"valid_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scheduling"."booking_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"participant_ref" varchar(160) NOT NULL,
	"resource_id" uuid,
	"role" varchar(16) NOT NULL,
	"response_status" varchar(16)
);
--> statement-breakpoint
CREATE TABLE "scheduling"."booking_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"resource_id" uuid NOT NULL,
	"during_start" timestamp with time zone NOT NULL,
	"during_end" timestamp with time zone NOT NULL,
	"blocking_start" timestamp with time zone NOT NULL,
	"blocking_end" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scheduling"."bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"service_id" uuid,
	"title" varchar(200) NOT NULL,
	"status" varchar(16) NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"customer_ref" varchar(160),
	"organizer_ref" varchar(160),
	"meeting_url" text,
	"external_calendar_id" varchar(160),
	"notes" text,
	"cancelled_at" timestamp with time zone,
	"cancelled_by" varchar(160),
	"cancellation_reason" varchar(500),
	"reminder_sent_at" timestamp with time zone,
	"idempotency_key" varchar(160),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scheduling"."resource_services" (
	"company_id" uuid NOT NULL,
	"resource_id" uuid NOT NULL,
	"service_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scheduling"."resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" varchar(160) NOT NULL,
	"kind" varchar(16) NOT NULL,
	"timezone" varchar(64) NOT NULL,
	"external_ref" varchar(160),
	"active" boolean DEFAULT true NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scheduling"."services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" varchar(160) NOT NULL,
	"description" text,
	"duration_minutes" integer NOT NULL,
	"buffer_before_minutes" integer DEFAULT 0 NOT NULL,
	"buffer_after_minutes" integer DEFAULT 0 NOT NULL,
	"price_in_cents" integer,
	"requires_confirmation" boolean DEFAULT false NOT NULL,
	"min_cancellation_notice_minutes" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "scheduling"."availability_exceptions" ADD CONSTRAINT "availability_exceptions_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "scheduling"."resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduling"."availability_rules" ADD CONSTRAINT "availability_rules_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "scheduling"."resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduling"."booking_participants" ADD CONSTRAINT "booking_participants_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "scheduling"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduling"."booking_participants" ADD CONSTRAINT "booking_participants_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "scheduling"."resources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduling"."booking_slots" ADD CONSTRAINT "booking_slots_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "scheduling"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduling"."booking_slots" ADD CONSTRAINT "booking_slots_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "scheduling"."resources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduling"."bookings" ADD CONSTRAINT "bookings_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "scheduling"."services"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduling"."resource_services" ADD CONSTRAINT "resource_services_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "scheduling"."resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduling"."resource_services" ADD CONSTRAINT "resource_services_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "scheduling"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_availability_exceptions_resource_during" ON "scheduling"."availability_exceptions" USING btree ("resource_id","during_start","during_end");--> statement-breakpoint
CREATE INDEX "idx_availability_rules_resource_weekday" ON "scheduling"."availability_rules" USING btree ("resource_id","weekday");--> statement-breakpoint
CREATE INDEX "idx_booking_participants_booking" ON "scheduling"."booking_participants" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "idx_booking_slots_resource" ON "scheduling"."booking_slots" USING btree ("resource_id","during_start");--> statement-breakpoint
CREATE INDEX "idx_bookings_company_status_starts" ON "scheduling"."bookings" USING btree ("company_id","status","starts_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_bookings_company_idempotency" ON "scheduling"."bookings" USING btree ("company_id","idempotency_key") WHERE "scheduling"."bookings"."idempotency_key" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_resource_services_pair" ON "scheduling"."resource_services" USING btree ("resource_id","service_id");--> statement-breakpoint
CREATE INDEX "idx_resource_services_company_service" ON "scheduling"."resource_services" USING btree ("company_id","service_id");--> statement-breakpoint
CREATE INDEX "idx_resources_company_active" ON "scheduling"."resources" USING btree ("company_id","active");--> statement-breakpoint
CREATE INDEX "idx_resources_company_kind" ON "scheduling"."resources" USING btree ("company_id","kind");--> statement-breakpoint
CREATE INDEX "idx_services_company_active" ON "scheduling"."services" USING btree ("company_id","active","sort_order");--> statement-breakpoint
-- Colunas de range geradas (T2.3/T2.4) — não vivem em `schema/schema.ts` porque a aplicação nunca
-- as escreve: elas derivam de `*_start`/`*_end` por `GENERATED ALWAYS ... STORED`, e o
-- repositório sempre lê/grava os limites, nunca o range. `[)` (fechado no início, aberto no fim)
-- é a mesma semântica de `TimeRange` em `scheduling-contracts`: dois compromissos ponta-a-ponta
-- (10:00–11:00 e 11:00–12:00) não se sobrepõem.
ALTER TABLE "scheduling"."booking_slots" ADD COLUMN "during" tstzrange GENERATED ALWAYS AS (tstzrange("during_start", "during_end", '[)')) STORED;--> statement-breakpoint
ALTER TABLE "scheduling"."booking_slots" ADD COLUMN "blocking" tstzrange GENERATED ALWAYS AS (tstzrange("blocking_start", "blocking_end", '[)')) STORED;--> statement-breakpoint
ALTER TABLE "scheduling"."availability_exceptions" ADD COLUMN "during" tstzrange GENERATED ALWAYS AS (tstzrange("during_start", "during_end", '[)')) STORED;--> statement-breakpoint
-- O núcleo da spec (§5.1/§5.2): "agendar serviço" e "marcar reunião" são o mesmo caso porque os
-- dois viram 1+ linhas de `booking_slots`, uma por recurso, e esta constraint protege qualquer
-- quantidade de recursos do mesmo jeito. A checagem acontece dentro da mesma transação que insere
-- a linha — não há janela entre "checar se está livre" e "gravar" para uma corrida vencer.
ALTER TABLE "scheduling"."booking_slots" ADD CONSTRAINT "booking_slot_no_overlap" EXCLUDE USING gist ("resource_id" WITH =, "blocking" WITH &&);--> statement-breakpoint
CREATE INDEX "idx_booking_slots_resource_during_gist" ON "scheduling"."booking_slots" USING gist ("resource_id", "during");--> statement-breakpoint
CREATE INDEX "idx_availability_exceptions_resource_during_gist" ON "scheduling"."availability_exceptions" USING gist ("resource_id", "during");