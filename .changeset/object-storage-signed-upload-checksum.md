---
'@adatechnology/object-storage-provider': patch
---

A URL assinada de PUT deixa de amarrar o CRC32 do corpo vazio. O `S3Client` passa a usar
`requestChecksumCalculation` e `responseChecksumValidation` em `WHEN_REQUIRED`: com o padrão do SDK
3.1091 (`WHEN_SUPPORTED`), o storage que confere o checksum (MinIO recente, SeaweedFS) recusava o
upload direto com `BadDigest`. O consumidor não precisa mais ligar `AWS_REQUEST_CHECKSUM_CALCULATION`.
