-- `IF NOT EXISTS` pelo mesmo motivo do baseline: num banco em rc.2 esta migration roda logo
-- depois dele, e a coluna pode já existir se o host tiver aplicado a versão anterior deste
-- arquivo antes da correção.
ALTER TABLE "notification"."deliveries" ADD COLUMN IF NOT EXISTS "attachments" jsonb;