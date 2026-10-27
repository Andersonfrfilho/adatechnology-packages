-- Reaproveitamento do arquivo já subido para a Meta.
--
-- Sem isto o mesmo binário subia de novo para cada cliente que passava por um nó `send_media`. A
-- Meta aceita reusar o `media_id` por 30 dias; o mapa é por `phone_number_id` porque o id é
-- escopado ao número remetente, e uma instalação com dois números mandaria o id de um pelo outro.
--
-- Aditiva com default: linha existente passa a ter mapa vazio e cai no caminho de subir o binário,
-- que é exatamente o comportamento anterior.
ALTER TABLE meta_whatsapp.flow_media
  ADD COLUMN IF NOT EXISTS meta_media_ids JSONB NOT NULL DEFAULT '{}'::jsonb;
