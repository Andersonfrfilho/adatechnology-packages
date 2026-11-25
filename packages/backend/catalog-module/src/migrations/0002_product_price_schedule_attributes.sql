-- Preço opcional: NULL = "sob consulta". Só relaxa a restrição; nenhuma linha existente muda.
ALTER TABLE "catalog"."products" ALTER COLUMN "price_in_cents" DROP NOT NULL;--> statement-breakpoint
-- Agenda de disponibilidade (dias + horário + fuso) e dados livres do host. `attributes` nasce
-- `{}` para não exigir backfill.
ALTER TABLE "catalog"."products" ADD COLUMN IF NOT EXISTS "availability_schedule" jsonb;--> statement-breakpoint
ALTER TABLE "catalog"."products" ADD COLUMN IF NOT EXISTS "attributes" jsonb DEFAULT '{}'::jsonb NOT NULL;
