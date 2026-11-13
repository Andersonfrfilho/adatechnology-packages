CREATE SCHEMA "infra";
--> statement-breakpoint
CREATE TABLE "infra"."infra_environment_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"railway_project_id" varchar(64) NOT NULL,
	"railway_environment_id" varchar(64) NOT NULL,
	"active_weekdays" smallint[] NOT NULL,
	"power_on_time" varchar(5) NOT NULL,
	"power_off_time" varchar(5) NOT NULL,
	"timezone" varchar(40) DEFAULT 'America/Sao_Paulo' NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"keep_on_until" timestamp with time zone,
	"last_evaluated_at" timestamp with time zone,
	"last_power_off_at" timestamp with time zone,
	"last_power_on_at" timestamp with time zone,
	"updated_by_agent_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "infra_environment_schedules_railway_environment_id_unique" UNIQUE("railway_environment_id")
);
--> statement-breakpoint
CREATE TABLE "infra"."infra_integration_secrets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" varchar(20) NOT NULL,
	"workspace_id" varchar(64) NOT NULL,
	"ciphertext" text NOT NULL,
	"key_id" varchar(16) NOT NULL,
	"token_hint" varchar(4) NOT NULL,
	"updated_by_agent_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "infra_integration_secrets_provider_unique" UNIQUE("provider")
);
--> statement-breakpoint
CREATE TABLE "infra"."infra_power_operations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"railway_project_id" varchar(64) NOT NULL,
	"railway_environment_id" varchar(64) NOT NULL,
	"kind" varchar(20) NOT NULL,
	"status" varchar(20) NOT NULL,
	"trigger" varchar(20) NOT NULL,
	"actor_agent_id" uuid,
	"service_results" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "infra_power_operations_environment_started_idx" ON "infra"."infra_power_operations" USING btree ("railway_environment_id","started_at");--> statement-breakpoint
CREATE INDEX "infra_power_operations_status_idx" ON "infra"."infra_power_operations" USING btree ("status");