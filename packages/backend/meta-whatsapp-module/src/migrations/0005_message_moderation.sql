ALTER TABLE "meta_whatsapp"."messages" ADD COLUMN "moderation_flagged" boolean;--> statement-breakpoint
ALTER TABLE "meta_whatsapp"."messages" ADD COLUMN "moderation_terms" jsonb;--> statement-breakpoint
CREATE INDEX "idx_messages_moderation_flagged" ON "meta_whatsapp"."messages" ("company_id","created_at") WHERE "moderation_flagged";
