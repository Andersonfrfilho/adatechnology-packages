-- No-op deliberado. Este nome existe só para casar com a 0.1.0-rc.3, cuja terceira migration a
-- TransportAdA já aplicou: o migrator 1.x decide "já aplicada" pelo NOME da pasta, então ele
-- precisa continuar presente, e a ausência dele faria o host reaplicar o que veio depois.
--
-- O conteúdo que ela tinha (device_id e sua FK) vive agora no baseline convergente
-- `20260802053704_melodic_selene` e em `20260802130118_jittery_raider`, ambos idempotentes.
SELECT 1;
