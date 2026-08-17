---
'@adatechnology/meta-whatsapp-provider': patch
---

Descarta os metadados do container de origem ao transcodificar áudio para ogg/opus
(`-map_metadata -1`). Com os metadados herdados do MP4 no OpusTags, a Meta recusa o arquivo com
131053 mesmo sendo um ogg/opus válido que ela aceitou no upload.
