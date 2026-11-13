DROP INDEX "meta_whatsapp"."idx_messages_wa_message_id";--> statement-breakpoint
ALTER TABLE "meta_whatsapp"."sessions" ADD COLUMN "flow_key" varchar(64);--> statement-breakpoint
ALTER TABLE "meta_whatsapp"."sessions" ADD COLUMN "current_node_id" varchar(64);--> statement-breakpoint
CREATE UNIQUE INDEX "idx_messages_company_wa_message_id" ON "meta_whatsapp"."messages" ("company_id","wa_message_id") WHERE "wa_message_id" is not null;--> statement-breakpoint
CREATE INDEX "idx_sessions_company_flow_node" ON "meta_whatsapp"."sessions" ("company_id","flow_key","current_node_id");