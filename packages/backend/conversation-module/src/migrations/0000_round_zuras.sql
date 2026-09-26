-- Editado à mão (spec 211 T202): `IF NOT EXISTS` no schema, para o migrator injetado pelo host
-- (`runConversationMigrations`) poder rodar contra um banco onde outra migration do próprio host
-- já criou o schema `conversation` por algum outro caminho, sem `42P06`. É o mesmo raciocínio do
-- baseline do `notification-module`.
CREATE SCHEMA IF NOT EXISTS "conversation";
--> statement-breakpoint
CREATE TABLE "conversation"."attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"message_id" uuid NOT NULL,
	"bucket" text NOT NULL,
	"object_key" text NOT NULL,
	"sha256" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"content_type" text NOT NULL,
	"kind" text NOT NULL,
	"file_name" text DEFAULT '' NOT NULL,
	"duration_ms" integer,
	"transcript_text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attachments_company_id_id_unique" UNIQUE("company_id","id"),
	CONSTRAINT "attachments_sha256_check" CHECK ("conversation"."attachments"."sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "attachments_size_check" CHECK ("conversation"."attachments"."size_bytes" > 0),
	CONSTRAINT "attachments_kind_check" CHECK ("conversation"."attachments"."kind" in ('audio', 'document', 'image')),
	CONSTRAINT "attachments_duration_check" CHECK ("conversation"."attachments"."duration_ms" is null or "conversation"."attachments"."duration_ms" > 0)
);
--> statement-breakpoint
CREATE TABLE "conversation"."messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"direction" text NOT NULL,
	"author_user_id" uuid,
	"automatic" boolean DEFAULT false NOT NULL,
	"sender_address" text,
	"body_text" text DEFAULT '' NOT NULL,
	"status" text,
	"status_times" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"provider_message_id" text,
	"transport_ref" text,
	"dkim_result" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "messages_company_id_id_unique" UNIQUE("company_id","id"),
	CONSTRAINT "messages_company_id_channel_provider_message_id_unique" UNIQUE("company_id","channel","provider_message_id"),
	CONSTRAINT "messages_channel_check" CHECK ("conversation"."messages"."channel" in ('email', 'whatsapp', 'app', 'portal', 'webchat')),
	CONSTRAINT "messages_direction_check" CHECK ("conversation"."messages"."direction" in ('inbound', 'outbound')),
	CONSTRAINT "messages_author_check" CHECK (("conversation"."messages"."direction" = 'outbound' and ("conversation"."messages"."author_user_id" is not null) <> "conversation"."messages"."automatic" and "conversation"."messages"."sender_address" is null)
        or ("conversation"."messages"."direction" = 'inbound' and not "conversation"."messages"."automatic" and num_nonnulls("conversation"."messages"."author_user_id", "conversation"."messages"."sender_address") = 1
          and ("conversation"."messages"."author_user_id" is null or "conversation"."messages"."channel" in ('app', 'portal', 'webchat'))
          and ("conversation"."messages"."sender_address" is null or "conversation"."messages"."channel" in ('email', 'whatsapp', 'webchat')))),
	CONSTRAINT "messages_status_check" CHECK ("conversation"."messages"."status" is null or "conversation"."messages"."status" in ('queued', 'sent', 'delivered', 'read', 'failed', 'bounced')),
	CONSTRAINT "messages_status_direction_check" CHECK (("conversation"."messages"."direction" = 'outbound') = ("conversation"."messages"."status" is not null)),
	CONSTRAINT "messages_dkim_result_check" CHECK ("conversation"."messages"."dkim_result" is null or ("conversation"."messages"."dkim_result" in ('aligned', 'not_aligned', 'unverifiable', 'absent') and "conversation"."messages"."channel" = 'email' and "conversation"."messages"."direction" = 'inbound')),
	CONSTRAINT "messages_body_length_check" CHECK (length("conversation"."messages"."body_text") <= 8000),
	CONSTRAINT "messages_email_reachable_status_check" CHECK ("conversation"."messages"."channel" <> $1 or "conversation"."messages"."status" is null or "conversation"."messages"."status" in ('queued', 'sent', 'delivered', 'failed', 'bounced')),
	CONSTRAINT "messages_whatsapp_reachable_status_check" CHECK ("conversation"."messages"."channel" <> $1 or "conversation"."messages"."status" is null or "conversation"."messages"."status" in ('queued', 'sent', 'delivered', 'read', 'failed')),
	CONSTRAINT "messages_app_reachable_status_check" CHECK ("conversation"."messages"."channel" <> $1 or "conversation"."messages"."status" is null or "conversation"."messages"."status" in ('queued', 'delivered', 'read')),
	CONSTRAINT "messages_portal_reachable_status_check" CHECK ("conversation"."messages"."channel" <> $1 or "conversation"."messages"."status" is null or "conversation"."messages"."status" in ('delivered', 'read')),
	CONSTRAINT "messages_webchat_reachable_status_check" CHECK ("conversation"."messages"."channel" <> $1 or "conversation"."messages"."status" is null or "conversation"."messages"."status" in ('queued', 'delivered', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "conversation"."participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"identifier" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "participants_company_id_conversation_id_channel_identifier_unique" UNIQUE("company_id","conversation_id","channel","identifier"),
	CONSTRAINT "participants_channel_check" CHECK ("conversation"."participants"."channel" in ('email', 'whatsapp', 'app', 'portal', 'webchat'))
);
--> statement-breakpoint
CREATE TABLE "conversation"."quick_replies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"audience" text NOT NULL,
	"body_text" text NOT NULL,
	"position" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quick_replies_body_text_check" CHECK (char_length(btrim("conversation"."quick_replies"."body_text")) between 1 and 500),
	CONSTRAINT "quick_replies_position_check" CHECK ("conversation"."quick_replies"."position" >= 0)
);
--> statement-breakpoint
CREATE TABLE "conversation"."reads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"last_read_message_id" uuid NOT NULL,
	"read_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reads_company_id_conversation_id_user_id_unique" UNIQUE("company_id","conversation_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "conversation"."unassigned" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"sender_address" text NOT NULL,
	"body_text" text DEFAULT '' NOT NULL,
	"provider_message_id" text,
	"transport_ref" text,
	"dkim_result" text,
	"received_at" timestamp with time zone NOT NULL,
	"assigned_message_id" uuid,
	"assigned_at" timestamp with time zone,
	"assigned_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unassigned_company_id_id_unique" UNIQUE("company_id","id"),
	CONSTRAINT "unassigned_company_id_channel_provider_message_id_unique" UNIQUE("company_id","channel","provider_message_id"),
	CONSTRAINT "unassigned_channel_check" CHECK ("conversation"."unassigned"."channel" in ('email', 'whatsapp', 'app', 'portal', 'webchat')),
	CONSTRAINT "unassigned_assignment_check" CHECK (num_nonnulls("conversation"."unassigned"."assigned_message_id", "conversation"."unassigned"."assigned_at", "conversation"."unassigned"."assigned_by_user_id") in (0, 3))
);
--> statement-breakpoint
CREATE TABLE "conversation"."uploads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"requested_by_user_id" uuid NOT NULL,
	"bucket" text NOT NULL,
	"object_key" text NOT NULL,
	"declared_content_type" text NOT NULL,
	"declared_size_bytes" integer NOT NULL,
	"file_name" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"attached_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uploads_company_id_object_key_unique" UNIQUE("company_id","object_key"),
	CONSTRAINT "uploads_status_check" CHECK ("conversation"."uploads"."status" in ('pending', 'attached', 'expired')),
	CONSTRAINT "uploads_channel_check" CHECK ("conversation"."uploads"."channel" in ('email', 'whatsapp', 'app', 'portal', 'webchat')),
	CONSTRAINT "uploads_size_check" CHECK ("conversation"."uploads"."declared_size_bytes" > 0),
	CONSTRAINT "uploads_file_name_check" CHECK (char_length("conversation"."uploads"."file_name") <= 200),
	CONSTRAINT "uploads_attached_check" CHECK (("conversation"."uploads"."status" = 'attached') = ("conversation"."uploads"."attached_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "conversation"."conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"subject_type" text,
	"subject_id" text,
	"audience" text,
	"public_ref" text,
	"status" text DEFAULT 'open' NOT NULL,
	"default_channel" text,
	"window_notice_sent_for" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "conversations_company_id_id_unique" UNIQUE("company_id","id"),
	CONSTRAINT "conversations_company_id_public_ref_unique" UNIQUE("company_id","public_ref"),
	CONSTRAINT "conversations_status_check" CHECK ("conversation"."conversations"."status" in ('open', 'closed')),
	CONSTRAINT "conversations_default_channel_check" CHECK ("conversation"."conversations"."default_channel" is null or "conversation"."conversations"."default_channel" in ('email', 'whatsapp', 'app', 'portal', 'webchat')),
	CONSTRAINT "conversations_subject_pair_check" CHECK (("conversation"."conversations"."subject_type" is null) = ("conversation"."conversations"."subject_id" is null)),
	CONSTRAINT "conversations_public_ref_check" CHECK ("conversation"."conversations"."public_ref" is null or "conversation"."conversations"."public_ref" ~ '^[A-Za-z0-9_-]{22,64}$')
);
--> statement-breakpoint
ALTER TABLE "conversation"."attachments" ADD CONSTRAINT "attachments_message_fk" FOREIGN KEY ("company_id","message_id") REFERENCES "conversation"."messages"("company_id","id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "conversation"."messages" ADD CONSTRAINT "messages_conversation_fk" FOREIGN KEY ("company_id","conversation_id") REFERENCES "conversation"."conversations"("company_id","id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "conversation"."participants" ADD CONSTRAINT "participants_conversation_fk" FOREIGN KEY ("company_id","conversation_id") REFERENCES "conversation"."conversations"("company_id","id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "conversation"."reads" ADD CONSTRAINT "reads_conversation_fk" FOREIGN KEY ("company_id","conversation_id") REFERENCES "conversation"."conversations"("company_id","id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "conversation"."reads" ADD CONSTRAINT "reads_message_fk" FOREIGN KEY ("company_id","last_read_message_id") REFERENCES "conversation"."messages"("company_id","id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "conversation"."unassigned" ADD CONSTRAINT "unassigned_assigned_message_fk" FOREIGN KEY ("company_id","assigned_message_id") REFERENCES "conversation"."messages"("company_id","id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "conversation"."uploads" ADD CONSTRAINT "uploads_conversation_fk" FOREIGN KEY ("company_id","conversation_id") REFERENCES "conversation"."conversations"("company_id","id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "attachments_message_idx" ON "conversation"."attachments" USING btree ("company_id","message_id");--> statement-breakpoint
CREATE INDEX "messages_conversation_created_idx" ON "conversation"."messages" USING btree ("company_id","conversation_id","created_at","id");--> statement-breakpoint
CREATE INDEX "quick_replies_audience_position_idx" ON "conversation"."quick_replies" USING btree ("company_id","audience","position");--> statement-breakpoint
CREATE INDEX "unassigned_open_idx" ON "conversation"."unassigned" USING btree ("company_id","received_at") WHERE "conversation"."unassigned"."assigned_message_id" is null;--> statement-breakpoint
CREATE INDEX "uploads_status_expires_idx" ON "conversation"."uploads" USING btree ("status","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "conversations_subject_audience_unique" ON "conversation"."conversations" USING btree ("company_id","subject_type","subject_id",coalesce("audience", '')) WHERE "conversation"."conversations"."subject_type" is not null;