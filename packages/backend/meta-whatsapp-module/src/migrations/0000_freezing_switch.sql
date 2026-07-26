CREATE SCHEMA "meta_whatsapp";
--> statement-breakpoint
CREATE TABLE "meta_whatsapp"."messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"company_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"whatsapp_number" varchar(20) NOT NULL,
	"direction" varchar(12) NOT NULL,
	"sender" varchar(12) NOT NULL,
	"agent_user_id" uuid,
	"type" varchar(16) DEFAULT 'text' NOT NULL,
	"content" text,
	"payload" jsonb,
	"wa_message_id" varchar(128),
	"status" varchar(16),
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meta_whatsapp"."sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"company_id" uuid NOT NULL,
	"whatsapp_number" varchar(20) NOT NULL,
	"current_state" varchar(64) DEFAULT 'start' NOT NULL,
	"context" jsonb DEFAULT '{}' NOT NULL,
	"mode" varchar(12) DEFAULT 'bot' NOT NULL,
	"assigned_user_id" uuid,
	"human_requested_at" timestamp with time zone,
	"last_inbound_at" timestamp with time zone,
	"last_agent_read_at" timestamp with time zone,
	"last_activity" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_messages_session_created" ON "meta_whatsapp"."messages" ("session_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_messages_company_number_created" ON "meta_whatsapp"."messages" ("company_id","whatsapp_number","created_at");--> statement-breakpoint
CREATE INDEX "idx_messages_wa_message_id" ON "meta_whatsapp"."messages" ("wa_message_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_sessions_company_number" ON "meta_whatsapp"."sessions" ("company_id","whatsapp_number");--> statement-breakpoint
CREATE INDEX "idx_sessions_company_mode" ON "meta_whatsapp"."sessions" ("company_id","mode");--> statement-breakpoint
ALTER TABLE "meta_whatsapp"."messages" ADD CONSTRAINT "messages_session_id_sessions_id_fkey" FOREIGN KEY ("session_id") REFERENCES "meta_whatsapp"."sessions"("id") ON DELETE CASCADE;